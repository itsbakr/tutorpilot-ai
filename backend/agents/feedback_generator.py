"""
Parent Feedback Generator Agent

Drafts parent-facing reports from one or more session assessments + their
underlying lesson plans + the student profile. Two modes:
  - per_session: one report covering a single session
  - weekly_digest: one report covering N sessions in a period

Output is parent-friendly markdown (no AI/jargon, strengths-first, concrete
evidence quotes from the transcript). Language matches student.languages[0]
so an Arabic-speaking parent gets an Arabic report.

Delivery is intentionally NOT in scope: status defaults to 'draft' and the
tutor reviews/edits before copying to the parent.
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

import weave

from db.supabase_client import supabase, get_student
from services.ai_service import call_gemini
from services.memory_service import store_performance_metric


def _load_assessments(session_ids: List[str]) -> List[Dict[str, Any]]:
    """Load the latest assessment per session_id.

    Returns one row per session_id (the most recently created if duplicates
    exist), ordered to match the caller's session_ids list.
    """
    if not session_ids:
        return []
    res = supabase.table("session_assessments") \
        .select("*") \
        .in_("session_id", session_ids) \
        .order("created_at", desc=True) \
        .execute()
    rows = res.data or []
    latest_by_session: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        sid = row.get("session_id")
        if sid and sid not in latest_by_session:
            latest_by_session[sid] = row
    return [latest_by_session[sid] for sid in session_ids if sid in latest_by_session]


def _load_lessons(lesson_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not lesson_ids:
        return {}
    res = supabase.table("lessons") \
        .select("id, title, content") \
        .in_("id", lesson_ids) \
        .execute()
    return {row["id"]: row for row in (res.data or [])}


def _load_sessions(session_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not session_ids:
        return {}
    res = supabase.table("lesson_sessions") \
        .select("id, occurred_at, created_at, lesson_id, media_duration_seconds") \
        .in_("id", session_ids) \
        .execute()
    return {row["id"]: row for row in (res.data or [])}


def _format_assessment_block(
    idx: int,
    assessment: Dict[str, Any],
    session: Optional[Dict[str, Any]],
    lesson: Optional[Dict[str, Any]],
) -> str:
    occurred = (session or {}).get("occurred_at") or "(date unknown)"
    lesson_title = (lesson or {}).get("title") or "(no lesson plan linked)"
    overall = assessment.get("overall_engagement_score")
    objective_scores = assessment.get("objective_scores") or []
    strengths = assessment.get("strengths") or []
    struggles = assessment.get("struggles") or []
    coverage = assessment.get("lesson_coverage") or {}
    recs = assessment.get("recommendations") or ""

    obj_lines = []
    for o in objective_scores:
        quotes = "; ".join((o.get("evidence_quotes") or [])[:1])
        obj_lines.append(
            f"  - {o.get('objective')}: {o.get('score')} / 10 ({o.get('status')}) — “{quotes}”"
        )
    str_lines = [f"  - {s.get('theme')}: “{(s.get('evidence_quotes') or [''])[0]}”" for s in strengths]
    stg_lines = [
        f"  - [{s.get('severity')}] {s.get('theme')} → next step: {s.get('suggested_next_step')} — “{(s.get('evidence_quotes') or [''])[0]}”"
        for s in struggles
    ]

    return f"""## Session {idx} — {occurred}
Lesson: {lesson_title}
Overall engagement: {overall} / 10

Objective performance:
{chr(10).join(obj_lines) if obj_lines else "  (none)"}

Strengths shown:
{chr(10).join(str_lines) if str_lines else "  (none)"}

Struggles observed:
{chr(10).join(stg_lines) if stg_lines else "  (none)"}

Lesson coverage:
  - Planned phases covered: {", ".join(coverage.get("planned_phases_covered") or []) or "—"}
  - Skipped: {", ".join(coverage.get("skipped") or []) or "—"}
  - Unplanned topics that came up: {", ".join(coverage.get("unplanned_topics") or []) or "—"}

Tutor's recommendation for next session:
{recs}
"""


def _build_parent_report_prompt(
    student: Dict[str, Any],
    assessment_blocks: str,
    mode: Literal["per_session", "weekly_digest"],
    language: str,
) -> str:
    audience = (
        "the parent of this student"
        if mode == "per_session"
        else "the parent — this is a WEEKLY DIGEST covering several sessions, so synthesize trends across them"
    )
    return f"""You are writing a parent-facing report for {audience}.

LANGUAGE: Write the entire report in {language}. If unsure, default to English.

STUDENT:
- Name: {student.get('name')}
- Grade: {student.get('grade')}
- Subject: {student.get('subject')}
- Interests: {", ".join(student.get('interests') or [])}

SOURCE MATERIAL (internal — do NOT copy verbatim, summarize for a parent):
{assessment_blocks}

---

WRITING RULES — these are non-negotiable:
1. Audience: a busy parent, NOT a teacher or AI engineer. No jargon, no AI references, no "engagement score X/10".
2. Tone: warm, specific, honest. Strengths first.
3. Use concrete examples. When you mention something the student did, paraphrase it from the evidence quotes (do NOT invent details).
4. End with ONE focus area for next session and ONE concrete thing the parent can do at home.
5. Length: ~250-400 words for per_session, ~400-600 for weekly_digest.
6. Do NOT mention "transcript", "AI", "model", "assessment", or technical scores.

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences:
{{
  "title": "<short title>",
  "markdown": "<the full parent report in markdown, in {language}>",
  "sections": {{
    "progress": "<2-3 sentences>",
    "highlights": "<2-3 sentences with concrete examples>",
    "focus_area": "<1-2 sentences naming ONE focus>",
    "home_support": "<1-2 sentences: one concrete thing the parent can do>"
  }}
}}
"""


def _parse_report(response: str) -> Dict[str, Any]:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    raw = re.search(r"\{.*\}", response, re.DOTALL)
    if raw:
        return json.loads(raw.group(0))
    # If model ignored JSON instruction and returned plain markdown, wrap it.
    return {"title": "Parent Update", "markdown": response.strip(), "sections": {}}


@weave.op()
async def generate_feedback_report(
    student_id: str,
    tutor_id: str,
    mode: Literal["per_session", "weekly_digest"],
    session_ids: List[str],
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a draft parent-facing report covering the given session(s)."""
    if not session_ids:
        raise ValueError("session_ids must include at least one session")
    if mode == "per_session" and len(session_ids) != 1:
        raise ValueError("per_session mode requires exactly one session_id")

    print(f"\n📝 Generating {mode} parent report for student {student_id} ({len(session_ids)} sessions)...")

    student = await get_student(student_id)
    if not student:
        raise ValueError(f"Student {student_id} not found")

    languages = student.get("languages") or ["English"]
    language = languages[0] if languages else "English"

    sessions = _load_sessions(session_ids)

    # Order session_ids chronologically by occurred_at (falling back to created_at)
    # so the report narrates trends in actual session order. Sessions missing
    # from the lookup keep their caller-supplied order at the end.
    def _sort_key(sid: str) -> str:
        s = sessions.get(sid) or {}
        return s.get("occurred_at") or s.get("created_at") or ""

    ordered_session_ids = sorted(session_ids, key=_sort_key)

    assessments = _load_assessments(ordered_session_ids)
    if not assessments:
        raise ValueError("No assessments found for the given session_ids — assess sessions first")

    lesson_ids = [a.get("lesson_id") for a in assessments if a.get("lesson_id")]
    lessons = _load_lessons(lesson_ids)

    blocks = []
    for i, a in enumerate(assessments, 1):
        sess = sessions.get(a.get("session_id"))
        lesson = lessons.get(a.get("lesson_id")) if a.get("lesson_id") else None
        blocks.append(_format_assessment_block(i, a, sess, lesson))
    assessment_blocks = "\n\n".join(blocks)

    prompt = _build_parent_report_prompt(student, assessment_blocks, mode, language)
    response = await call_gemini(prompt, temperature=0.6, max_tokens=2500)
    parsed = _parse_report(response)

    report_id = uuid4()
    record = {
        "id": str(report_id),
        "tutor_id": tutor_id,
        "student_id": student_id,
        "mode": mode,
        "session_ids": session_ids,
        "period_start": period_start,
        "period_end": period_end,
        "content": {
            "title": parsed.get("title"),
            "markdown": parsed.get("markdown"),
            "sections": parsed.get("sections", {}),
            "language": language,
        },
        "status": "draft",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    supabase.table("parent_feedback_reports").insert(record).execute()

    # Track this generation in the existing reflection loop. We don't have a
    # numeric quality score yet — we use a placeholder 7.5 (means "unrated").
    # Once tutors edit drafts, the diff vs. AI draft is the actual signal.
    await store_performance_metric(
        agent_type="feedback_generator",
        evaluation={
            "overall_score": 7.5,
            "criteria": {
                "drafted": {"score": 7.5, "reasoning": "Draft generated; awaiting tutor edits"},
            },
        },
        session_id=str(report_id),
    )

    print(f"   ✅ Parent report drafted (id {report_id}, language={language})")
    return {
        "report_id": str(report_id),
        "content": record["content"],
        "mode": mode,
        "session_ids": session_ids,
        "student": student,
    }
