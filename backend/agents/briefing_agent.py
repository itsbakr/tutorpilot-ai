"""
Pre-Session Briefing Agent

Returns a 5-section briefing for the tutor's next session, in <800 tokens of
structured JSON. Inputs are all data we already have: student profile,
top-N memories, last 3 session assessments, upcoming lesson + its standards,
pending memory proposals.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import weave

from db.supabase_client import supabase, get_student, get_tutor
from services.ai_service import call_gemini
from services.agent_helpers import parse_json_safe, truncate
from services.memory_service import load_student_memories, store_performance_metric
from agents.standards_aligner import get_lesson_standards


def _format_memories(memories: List[Dict[str, Any]]) -> str:
    lines = []
    for m in memories[:8]:
        conf = m.get("confidence_score")
        conf_str = f"{float(conf):.2f}" if conf is not None else "n/a"
        val = json.dumps(m.get("memory_value"), ensure_ascii=False)[:160]
        lines.append(f"  • [{m.get('memory_category')}] {m.get('memory_key')} = {val} (conf {conf_str})")
    return "\n".join(lines) if lines else "  (none)"


def _format_recent_assessments(assessments: List[Dict[str, Any]]) -> str:
    if not assessments:
        return "  (no past sessions)"
    lines = []
    for a in assessments:
        lines.append(f"  • {a.get('created_at','?')[:10]} — engagement {a.get('overall_engagement_score','?')}/10")
        lines.append(f"    recommendation: {truncate(a.get('recommendations') or '', 220)}")
        for s in (a.get("struggles") or [])[:2]:
            quote = ((s.get("evidence_quotes") or [""])[0] or "")
            lines.append(f"    struggle: {s.get('theme')} — \"{truncate(quote, 100)}\"")
    return "\n".join(lines)


def _format_upcoming_lesson(lesson: Optional[Dict[str, Any]], standards: List[Dict[str, Any]]) -> str:
    if not lesson:
        return "(no upcoming lesson selected — give a generic prep)"
    standards_str = ", ".join(s["code"] for s in standards) or "no standards aligned yet"
    content = lesson.get("content") or {}
    snippet = json.dumps(content, ensure_ascii=False)[:1500]
    return f"TITLE: {lesson.get('title')}\nSTANDARDS: {standards_str}\nPLAN (truncated):\n{snippet}"


def _build_briefing_prompt(
    student: Dict[str, Any],
    memories: List[Dict[str, Any]],
    recent: List[Dict[str, Any]],
    upcoming_lesson: Optional[Dict[str, Any]],
    standards: List[Dict[str, Any]],
) -> str:
    return f"""You are a tutoring coach. In <800 tokens, draft a pre-session briefing for the tutor.

STUDENT:
  Name: {student.get('name')}, Grade: {student.get('grade')}, Subject: {student.get('subject')}
  Learning style: {student.get('learning_style')}
  Interests: {', '.join(student.get('interests') or [])}
  Languages: {', '.join(student.get('languages') or [])}

EXISTING MEMORY:
{_format_memories(memories)}

RECENT SESSIONS (most recent first, up to 3):
{_format_recent_assessments(recent)}

UPCOMING LESSON:
{_format_upcoming_lesson(upcoming_lesson, standards)}

Return ONLY valid JSON, no markdown fences:
{{
  "headline": "<one sentence: the single most important thing the tutor should remember>",
  "remember": [
    {{"point":"<short statement>","evidence":"<verbatim quote or memory line that supports it>"}}
  ],
  "watch_for": [
    {{"signal":"<observable behavior>","what_to_do":"<concrete action>"}}
  ],
  "open_questions": ["<questions left from prior sessions, max 3>"],
  "lesson_anchor_to_interest": "<one sentence connecting the lesson to a known student interest>",
  "warm_up_question": "<one Socratic opener to start the session>"
}}

Rules:
- 3-5 "remember" items, 2-3 "watch_for" items, 0-3 "open_questions".
- Every "remember" point MUST cite an evidence quote (from a memory entry or assessment quote). No claim without source.
- "warm_up_question" should be answerable in <30 seconds, open-ended, connected to the lesson.
- If there are no past sessions, base the briefing on the profile + memories only and say so honestly in the headline.
"""


@weave.op()
async def generate_briefing(
    student_id: str,
    tutor_id: str,
    upcoming_lesson_id: Optional[str] = None,
) -> Dict[str, Any]:
    student = await get_student(student_id)
    if not student:
        raise ValueError(f"Student {student_id} not found")

    memories = await load_student_memories(student_id, limit=10)

    recent = supabase.table("session_assessments") \
        .select("*") \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute()
    # Filter to this student via session join (cheap in Python; few rows expected)
    recent_rows: List[Dict[str, Any]] = []
    if recent.data:
        sids = [r.get("session_id") for r in recent.data]
        sess = supabase.table("lesson_sessions") \
            .select("id, student_id") \
            .in_("id", sids) \
            .execute()
        ours = {s["id"] for s in (sess.data or []) if s["student_id"] == student_id}
        recent_rows = [r for r in recent.data if r.get("session_id") in ours][:3]

    upcoming_lesson: Optional[Dict[str, Any]] = None
    standards: List[Dict[str, Any]] = []
    if upcoming_lesson_id:
        l = supabase.table("lessons").select("*").eq("id", upcoming_lesson_id).limit(1).execute()
        if l.data:
            upcoming_lesson = l.data[0]
            standards = await get_lesson_standards(upcoming_lesson_id)

    prompt = _build_briefing_prompt(student, memories, recent_rows, upcoming_lesson, standards)
    response = await call_gemini(prompt, temperature=0.5, max_tokens=1500)
    parsed = parse_json_safe(response, fallback={
        "headline": f"Briefing unavailable; review {student.get('name')}'s profile manually.",
        "remember": [], "watch_for": [], "open_questions": [],
        "lesson_anchor_to_interest": "", "warm_up_question": "",
    })

    bid = uuid4()
    record = {
        "id": str(bid),
        "student_id": student_id,
        "tutor_id": tutor_id,
        "upcoming_lesson_id": upcoming_lesson_id,
        "content": parsed,
        "generated_at": datetime.now().isoformat(),
    }
    supabase.table("pre_session_briefings").insert(record).execute()

    await store_performance_metric(
        agent_type="briefing_agent",
        evaluation={
            "overall_score": 8.0 if parsed.get("remember") else 4.0,
            "criteria": {"completeness": {"score": 8.0 if parsed.get("remember") else 4.0,
                                          "reasoning": "Has remember points"}},
        },
        session_id=str(bid),
    )

    return {"briefing_id": str(bid), "content": parsed, "student_id": student_id}


async def acknowledge_briefing(briefing_id: str) -> None:
    supabase.table("pre_session_briefings") \
        .update({"acknowledged_at": datetime.now().isoformat()}) \
        .eq("id", briefing_id) \
        .execute()
