"""
Misconception Detector

Aggregates struggle themes from session_assessments and wrong-answer themes
from homework_submissions over a window. A theme that appears in ≥ THRESHOLD
events is a misconception, surfaced as a notification + a learning_insight.
"""

from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Dict, List

import weave

from db.supabase_client import supabase
from services import notification_service
from services.memory_service import (
    write_finding,
    store_learning_insight,
    store_performance_metric,
)

THRESHOLD = 3


def _slugify(s: str) -> str:
    return "_".join(
        c if c.isalnum() else "_"
        for c in (s or "").lower().strip()
    ).strip("_")[:60]


def _gather_events(student_id: str, lookback_days: int) -> List[Dict[str, Any]]:
    cutoff = (datetime.now() - timedelta(days=lookback_days)).isoformat()
    events: List[Dict[str, Any]] = []

    sessions = supabase.table("lesson_sessions").select("id").eq("student_id", student_id).execute()
    sids = [s["id"] for s in (sessions.data or [])]
    if sids:
        ass = supabase.table("session_assessments") \
            .select("session_id, struggles, created_at, lesson_id") \
            .in_("session_id", sids) \
            .gte("created_at", cutoff) \
            .execute()
        for a in (ass.data or []):
            for s in (a.get("struggles") or []):
                theme = s.get("theme") or ""
                if not theme:
                    continue
                events.append({
                    "theme_slug": _slugify(theme),
                    "theme": theme,
                    "severity": s.get("severity") or "moderate",
                    "evidence": (s.get("evidence_quotes") or [""])[0],
                    "created_at": a.get("created_at"),
                    "source": "session",
                    "ref_id": a.get("session_id"),
                })

    asgs = supabase.table("homework_assignments").select("id, lesson_id").eq("student_id", student_id).execute()
    aids = [a["id"] for a in (asgs.data or [])]
    if aids:
        subs = supabase.table("homework_submissions") \
            .select("id, assignment_id, graded_results, graded_at") \
            .in_("assignment_id", aids) \
            .gte("graded_at", cutoff) \
            .execute()
        for sub in (subs.data or []):
            for r in (sub.get("graded_results") or []):
                if r.get("correct") in (True, "true"):
                    continue
                theme = r.get("misconception_theme")
                if not theme:
                    continue
                events.append({
                    "theme_slug": _slugify(theme),
                    "theme": theme,
                    "severity": "moderate",
                    "evidence": r.get("student_answer_excerpt") or "",
                    "created_at": sub.get("graded_at"),
                    "source": "homework",
                    "ref_id": sub.get("id"),
                })

    return events


@weave.op()
async def detect_misconceptions(student_id: str, lookback_days: int = 30) -> Dict[str, Any]:
    """Cluster struggle/wrong-answer events; emit notifications + learning_insights for each cluster ≥ THRESHOLD."""
    events = _gather_events(student_id, lookback_days)
    if not events:
        return {"student_id": student_id, "detected": [], "events_seen": 0}

    counts = Counter(e["theme_slug"] for e in events)
    detected: List[Dict[str, Any]] = []

    student = supabase.table("students").select("name, tutor_id").eq("id", student_id).limit(1).execute()
    student_name = (student.data[0].get("name") if student.data else "the student")
    tutor_id = student.data[0].get("tutor_id") if student.data else None

    for slug, count in counts.items():
        if count < THRESHOLD:
            continue
        cluster = [e for e in events if e["theme_slug"] == slug]
        # Pick the most descriptive theme label among the events
        labels = [e["theme"] for e in cluster]
        theme_label = max(set(labels), key=labels.count)
        severity = "high" if count >= THRESHOLD + 2 else "moderate"

        # Write into platform_memory as a persistent_misconception (auto, high confidence)
        await write_finding(
            entity_type="student", entity_id=student_id,
            memory_category="persistent_misconception",
            memory_key=slug,
            memory_value={
                "theme": theme_label,
                "supporting_events_count": count,
                "first_seen": min(e.get("created_at") or "" for e in cluster),
                "last_seen": max(e.get("created_at") or "" for e in cluster),
                "evidence_examples": [e["evidence"][:200] for e in cluster[:3]],
            },
            confidence_score=0.9,
        )

        # Store as a learning_insight (system-wide)
        await store_learning_insight(
            insight_type="pattern_recognition",
            description=f"{student_name}: recurring misconception '{theme_label}' across {count} events",
            supporting_evidence=[{"source": e["source"], "ref_id": e["ref_id"], "evidence": e["evidence"][:200]}
                                  for e in cluster[:5]],
            applicability={"student_ids": [student_id]},
            priority="high",
        )

        # Notify the tutor with a concrete CTA
        if tutor_id:
            await notification_service.create(
                recipient_tutor_id=tutor_id,
                category="misconception_detected",
                title=f"Recurring misconception: {theme_label}",
                body=f"{student_name} — {count} events. Consider a remediation lesson.",
                link=f"/students/{student_id}/misconceptions",
                priority="high",
                payload={"theme": theme_label, "slug": slug, "count": count, "student_id": student_id},
            )

        detected.append({
            "slug": slug,
            "theme": theme_label,
            "events_count": count,
            "severity": severity,
        })

    await store_performance_metric(
        agent_type="misconception_detector",
        evaluation={
            "overall_score": min(10.0, 5.0 + len(detected) * 1.5),
            "criteria": {"detected": {"score": min(10.0, 5.0 + len(detected) * 1.5),
                                       "reasoning": f"{len(detected)} clusters in {len(events)} events"}},
        },
        session_id=student_id,
    )

    return {"student_id": student_id, "detected": detected, "events_seen": len(events)}
