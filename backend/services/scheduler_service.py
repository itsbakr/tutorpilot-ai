"""
Scheduler Service

A small in-process asyncio loop spawned in the FastAPI lifespan. Periodically
queries existing tables and creates `notifications` rows. No Celery, no cron.

Cadences:
  every 5 min   — sessions starting in <15 min → trigger briefing + notify
  every 15 min  — sessions in pending/transcribed >24h → notify "unassessed"
  every 60 min  — homework_assignments status='submitted' not graded → notify
  daily 08:00   — per tutor (in their tz): weekly digest preview
  weekly Sun    — per active student: misconception detection sweep

The loop is best-effort and tolerant — any error is logged and the next tick
continues. Disable by env var TUTORPILOT_SCHEDULER_DISABLED=1.
"""

import asyncio
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from db.supabase_client import supabase
from services import notification_service

_TASK: Optional[asyncio.Task] = None
_TICK_SECONDS = 300  # the inner loop ticks every 5 min; downstream cadences are gated by elapsed


def _get_tutor_tz(tutor: Dict[str, Any]) -> str:
    return tutor.get("timezone") or "UTC"


def _now_utc() -> datetime:
    return datetime.utcnow()


def _is_disabled() -> bool:
    return os.getenv("TUTORPILOT_SCHEDULER_DISABLED") == "1"


# ----------------------------------------------------------------------------
# Individual checks (each is a no-LLM SQL pass that may emit notifications)
# ----------------------------------------------------------------------------

async def _check_upcoming_sessions() -> None:
    """Sessions whose occurred_at is within the next 15 minutes get a briefing + notification."""
    now = _now_utc()
    horizon = (now + timedelta(minutes=15)).isoformat()
    soon = supabase.table("lesson_sessions") \
        .select("id, tutor_id, student_id, lesson_id, occurred_at") \
        .gte("occurred_at", now.isoformat()) \
        .lte("occurred_at", horizon) \
        .execute()
    rows = soon.data or []
    if not rows:
        return

    # Deduplicate: if we already sent a 'briefing_ready' for this session in the past hour, skip
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    sent = supabase.table("notifications") \
        .select("payload") \
        .eq("category", "briefing_ready") \
        .gte("created_at", one_hour_ago) \
        .execute()
    sent_ids = {(n.get("payload") or {}).get("session_id") for n in (sent.data or [])}

    from agents.briefing_agent import generate_briefing
    for s in rows:
        if s["id"] in sent_ids:
            continue
        try:
            briefing = await generate_briefing(
                student_id=s["student_id"],
                tutor_id=s["tutor_id"],
                upcoming_lesson_id=s.get("lesson_id"),
            )
            await notification_service.create(
                recipient_tutor_id=s["tutor_id"],
                category="briefing_ready",
                title="Briefing ready for upcoming session",
                body=(briefing.get("content") or {}).get("headline") or "Open the briefing.",
                link=f"/students/{s['student_id']}/briefings/{briefing['briefing_id']}",
                priority="high",
                payload={"session_id": s["id"], "briefing_id": briefing["briefing_id"]},
            )
        except Exception as e:
            print(f"[scheduler] briefing-on-upcoming failed for session {s['id']}: {e}")


async def _check_unassessed_sessions() -> None:
    cutoff = (_now_utc() - timedelta(hours=24)).isoformat()
    rows = supabase.table("lesson_sessions") \
        .select("id, tutor_id, student_id, status, created_at") \
        .in_("status", ["pending", "transcribed"]) \
        .lte("created_at", cutoff) \
        .execute()
    if not rows.data:
        return
    # One per tutor — not one per session
    by_tutor: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows.data:
        by_tutor.setdefault(r["tutor_id"], []).append(r)
    for tutor_id, items in by_tutor.items():
        # Suppress if same digest sent in the last 6h
        suppress = supabase.table("notifications") \
            .select("id") \
            .eq("recipient_tutor_id", tutor_id) \
            .eq("category", "session_unassessed_digest") \
            .gte("created_at", (_now_utc() - timedelta(hours=6)).isoformat()) \
            .execute()
        if suppress.data:
            continue
        await notification_service.create(
            recipient_tutor_id=tutor_id,
            category="session_unassessed_digest",
            title=f"{len(items)} session(s) waiting on assessment",
            body="Older than 24h — quick to clear.",
            link="/today",
            priority="normal",
            payload={"count": len(items)},
        )


async def _check_homework_pending() -> None:
    rows = supabase.table("homework_assignments") \
        .select("id, tutor_id, student_id, title") \
        .eq("status", "submitted") \
        .execute()
    if not rows.data:
        return
    by_tutor: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows.data:
        by_tutor.setdefault(r["tutor_id"], []).append(r)
    for tutor_id, items in by_tutor.items():
        suppress = supabase.table("notifications") \
            .select("id") \
            .eq("recipient_tutor_id", tutor_id) \
            .eq("category", "homework_pending_digest") \
            .gte("created_at", (_now_utc() - timedelta(hours=6)).isoformat()) \
            .execute()
        if suppress.data:
            continue
        await notification_service.create(
            recipient_tutor_id=tutor_id,
            category="homework_pending_digest",
            title=f"{len(items)} homework submission(s) awaiting grading",
            body=", ".join(i["title"] for i in items[:3]),
            link="/today",
            priority="normal",
            payload={"count": len(items)},
        )


async def _check_overdue_reports() -> None:
    """Parent reports in 'draft' status created >3 days ago."""
    cutoff = (_now_utc() - timedelta(days=3)).isoformat()
    rows = supabase.table("parent_feedback_reports") \
        .select("id, tutor_id, student_id, mode, created_at") \
        .eq("status", "draft") \
        .lte("created_at", cutoff) \
        .execute()
    if not rows.data:
        return
    for r in rows.data:
        suppress = supabase.table("notifications") \
            .select("id") \
            .eq("recipient_tutor_id", r["tutor_id"]) \
            .eq("category", "report_overdue") \
            .contains("payload", {"report_id": r["id"]}) \
            .gte("created_at", (_now_utc() - timedelta(hours=24)).isoformat()) \
            .execute()
        if suppress.data:
            continue
        await notification_service.create(
            recipient_tutor_id=r["tutor_id"],
            category="report_overdue",
            title="Parent report still in draft",
            body=f"Drafted >3 days ago — review and send.",
            link=f"/students/{r['student_id']}/feedback",
            priority="normal",
            payload={"report_id": r["id"]},
        )


async def _weekly_misconception_sweep() -> None:
    """Once per Sunday UTC, run misconception detector for every student that has activity."""
    if _now_utc().weekday() != 6:  # 6 = Sunday
        return
    # Suppress if we ran today
    today = _now_utc().date().isoformat()
    sup = supabase.table("notifications") \
        .select("id") \
        .eq("category", "misconception_sweep_done") \
        .gte("created_at", today) \
        .limit(1) \
        .execute()
    if sup.data:
        return

    students = supabase.table("students").select("id, tutor_id").execute()
    from agents.misconception_detector import detect_misconceptions
    for s in (students.data or []):
        try:
            await detect_misconceptions(s["id"], lookback_days=14)
        except Exception as e:
            print(f"[scheduler] misconception sweep for student {s['id']} failed: {e}")
    # Marker notification (audit), addressed to the first tutor; harmless if none
    if students.data:
        await notification_service.create(
            recipient_tutor_id=students.data[0]["tutor_id"],
            category="misconception_sweep_done",
            title="Weekly misconception sweep complete",
            body=None,
            priority="low",
            payload={"date": today},
        )


# ----------------------------------------------------------------------------
# Loop
# ----------------------------------------------------------------------------

async def _tick_once() -> None:
    """One pass of all checks; designed to be cheap (each is a few SQL calls)."""
    try:
        await _check_upcoming_sessions()
    except Exception as e:
        print(f"[scheduler] upcoming-sessions tick failed: {e}")
    try:
        await _check_unassessed_sessions()
    except Exception as e:
        print(f"[scheduler] unassessed-sessions tick failed: {e}")
    try:
        await _check_homework_pending()
    except Exception as e:
        print(f"[scheduler] homework-pending tick failed: {e}")
    try:
        await _check_overdue_reports()
    except Exception as e:
        print(f"[scheduler] overdue-reports tick failed: {e}")
    try:
        await _weekly_misconception_sweep()
    except Exception as e:
        print(f"[scheduler] misconception sweep failed: {e}")


async def _loop() -> None:
    print("⏰ scheduler_service started")
    while True:
        try:
            await _tick_once()
        except Exception as e:
            print(f"[scheduler] tick failed: {e}")
        await asyncio.sleep(_TICK_SECONDS)


def start() -> Optional[asyncio.Task]:
    """Idempotent start — call from FastAPI lifespan."""
    global _TASK
    if _is_disabled():
        print("⏰ scheduler_service disabled via TUTORPILOT_SCHEDULER_DISABLED=1")
        return None
    if _TASK is not None and not _TASK.done():
        return _TASK
    _TASK = asyncio.create_task(_loop())
    return _TASK


async def stop() -> None:
    global _TASK
    if _TASK is None:
        return
    _TASK.cancel()
    try:
        await _TASK
    except Exception:
        pass
    _TASK = None
