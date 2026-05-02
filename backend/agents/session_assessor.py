"""
Session Assessor Agent

Ingests a tutor↔student session (audio/video), runs the transcription service,
compares the actual interaction to the planned lesson + student profile, and:
  1. Persists a structured assessment (per-objective scores, strengths,
     struggles, emotional arc, lesson coverage, recommendations).
  2. Writes confidence-tiered findings into the memory loop:
       confidence ≥ 0.8 → direct write to platform_memory
       confidence < 0.8 → staged in memory_proposals for tutor approval
  3. Stores a performance metric so the existing reflection loop picks it up.
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import weave

from db.supabase_client import supabase, get_student, get_tutor
from services.ai_service import call_gemini
from services.memory_service import (
    load_student_memories,
    store_performance_metric,
    write_finding,
    stage_memory_proposal,
)
from services import transcription_service

CONFIDENCE_AUTOWRITE_THRESHOLD = 0.8


def _truncate_utterances(utterances: List[Dict[str, Any]], max_chars: int = 18000) -> str:
    """Render utterances for the prompt, truncating to fit token budget."""
    lines: List[str] = []
    total = 0
    for u in utterances:
        role = u.get("speaker_role", "unknown")
        emo = u.get("emotion") or "neutral"
        ts = u.get("start_ms", 0) // 1000
        line = f"[{ts}s] {role} ({emo}): {u.get('text', '')}"
        if total + len(line) > max_chars:
            lines.append("…[transcript truncated]…")
            break
        lines.append(line)
        total += len(line)
    return "\n".join(lines)


def _format_lesson_for_prompt(lesson: Optional[Dict[str, Any]]) -> str:
    if not lesson:
        return "(No lesson plan was linked to this session — assess against student objectives instead.)"
    content = lesson.get("content") or {}
    title = lesson.get("title", "Untitled lesson")
    if isinstance(content, dict):
        # Try to surface 5E phases / objectives concisely
        rendered = json.dumps(content, ensure_ascii=False)[:4000]
    else:
        rendered = str(content)[:4000]
    return f"LESSON TITLE: {title}\nLESSON PLAN (truncated):\n{rendered}"


def _format_student_for_prompt(student: Dict[str, Any], memories: List[Dict[str, Any]]) -> str:
    base = (
        f"- Name: {student.get('name')}\n"
        f"- Grade: {student.get('grade')}\n"
        f"- Subject: {student.get('subject')}\n"
        f"- Learning style: {student.get('learning_style')}\n"
        f"- Languages: {', '.join(student.get('languages') or [])}\n"
        f"- Interests: {', '.join(student.get('interests') or [])}\n"
        f"- Objectives: {', '.join(student.get('objectives') or [])}\n"
    )
    if memories:
        mem_lines = []
        for m in memories[:8]:
            conf = m.get("confidence_score")
            conf_str = f"{float(conf):.2f}" if conf is not None else "n/a"
            mem_lines.append(
                f"  • [{m.get('memory_category')}] {m.get('memory_key')} = "
                f"{json.dumps(m.get('memory_value'), ensure_ascii=False)[:200]} "
                f"(conf {conf_str})"
            )
        base += "Existing memory:\n" + "\n".join(mem_lines)
    return base


def _build_assessment_prompt(
    transcript: Dict[str, Any],
    lesson: Optional[Dict[str, Any]],
    student: Dict[str, Any],
    memories: List[Dict[str, Any]],
) -> str:
    transcript_text = _truncate_utterances(transcript.get("utterances", []))
    lesson_text = _format_lesson_for_prompt(lesson)
    student_text = _format_student_for_prompt(student, memories)

    return f"""You are an expert pedagogy coach analyzing a tutoring session.

STUDENT PROFILE:
{student_text}

PLANNED LESSON (what the tutor intended to do):
{lesson_text}

ACTUAL SESSION TRANSCRIPT (diarized, with emotion tags):
{transcript_text}

---

YOUR TASK: Produce a rigorous assessment grounded in the transcript. Cite verbatim quotes as evidence — never invent.

Return ONLY valid JSON (no markdown fences, no commentary) with this exact shape:
{{
  "overall_engagement_score": <0-10 float>,
  "objective_scores": [
    {{
      "objective": "<one of the planned lesson objectives, or a derived one if no lesson>",
      "score": <0-10 float>,
      "status": "mastered" | "progressing" | "struggling" | "not_addressed",
      "evidence_quotes": ["<verbatim quote>", "..."]
    }}
  ],
  "strengths": [
    {{ "theme": "<short phrase>", "evidence_quotes": ["<quote>"] }}
  ],
  "struggles": [
    {{
      "theme": "<short phrase>",
      "severity": "minor" | "moderate" | "significant",
      "evidence_quotes": ["<quote>"],
      "suggested_next_step": "<concrete tutor action for next session>"
    }}
  ],
  "emotional_arc": [
    {{ "phase": "opening|main_concept|practice|closing", "dominant_emotion": "<label>", "note": "<brief>" }}
  ],
  "lesson_coverage": {{
    "planned_phases_covered": ["<phase>", ...],
    "skipped": ["<phase>", ...],
    "unplanned_topics": ["<topic>", ...]
  }},
  "recommendations": "<2-4 sentences directed to the tutor for the next session>",
  "memory_findings": [
    {{
      "category": "engagement_pattern" | "learning_preference" | "misconception" | "confidence_signal" | "interest_signal",
      "key": "<short stable identifier, snake_case>",
      "value": {{ "summary": "<1 sentence>", "evidence_quote": "<quote>" }},
      "confidence": <0.0-1.0>
    }}
  ]
}}

Rules:
- Every score and finding MUST cite at least one verbatim quote from the transcript.
- If the lesson was skipped or differed from plan, say so honestly in lesson_coverage.
- Be specific in recommendations — name the tutor action, not platitudes.
- memory_findings should capture durable behavioral signal about THIS student (not session-specific events). Aim for 2-6 findings.
"""


def _parse_assessment(response: str) -> Dict[str, Any]:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    raw = re.search(r"\{.*\}", response, re.DOTALL)
    if raw:
        return json.loads(raw.group(0))
    raise ValueError("Could not parse assessment JSON from model response")


@weave.op()
async def assess_session(session_id: str) -> Dict[str, Any]:
    """Main entry point: assess a session end-to-end and write back to the memory loop."""
    print(f"\n🔎 Assessing session {session_id}...")

    # Load session row
    session_row = supabase.table("lesson_sessions") \
        .select("*") \
        .eq("id", session_id) \
        .limit(1) \
        .execute()
    if not session_row.data:
        raise ValueError(f"Session {session_id} not found")
    session = session_row.data[0]

    # Load context
    student = await get_student(session["student_id"])
    if not student:
        raise ValueError(f"Student {session['student_id']} not found")
    tutor = await get_tutor(session["tutor_id"])
    memories = await load_student_memories(session["student_id"], limit=10)

    lesson: Optional[Dict[str, Any]] = None
    if session.get("lesson_id"):
        lesson_row = supabase.table("lessons") \
            .select("*") \
            .eq("id", session["lesson_id"]) \
            .limit(1) \
            .execute()
        if lesson_row.data:
            lesson = lesson_row.data[0]

    # 1) Transcribe (idempotent)
    transcript = await transcription_service.transcribe(session_id)

    # Mark assessing
    supabase.table("lesson_sessions").update({
        "status": "assessing",
        "updated_at": datetime.now().isoformat(),
    }).eq("id", session_id).execute()

    # 2) LLM assessment
    prompt = _build_assessment_prompt(transcript, lesson, student, memories)
    print("   🧠 Calling Gemini for structured assessment...")

    try:
        response = await call_gemini(prompt, temperature=0.4, max_tokens=4000)
        parsed = _parse_assessment(response)
    except Exception as e:
        supabase.table("lesson_sessions").update({
            "status": "failed",
            "status_error": f"assessment: {str(e)[:500]}",
            "updated_at": datetime.now().isoformat(),
        }).eq("id", session_id).execute()
        raise

    # 3) Persist assessment (replace any prior row so re-assessment is idempotent)
    assessment_id = uuid4()
    overall_score = float(parsed.get("overall_engagement_score") or 5.0)
    assessment_record = {
        "id": str(assessment_id),
        "session_id": session_id,
        "lesson_id": session.get("lesson_id"),
        "overall_engagement_score": overall_score,
        "objective_scores": parsed.get("objective_scores", []),
        "strengths": parsed.get("strengths", []),
        "struggles": parsed.get("struggles", []),
        "emotional_arc": parsed.get("emotional_arc", []),
        "lesson_coverage": parsed.get("lesson_coverage", {}),
        "recommendations": parsed.get("recommendations"),
        "raw_response": parsed,
        "created_at": datetime.now().isoformat(),
    }
    supabase.table("session_assessments").delete().eq("session_id", session_id).execute()
    supabase.table("session_assessments").insert(assessment_record).execute()

    # 4) Memory loop (confidence-tiered)
    findings = parsed.get("memory_findings", []) or []
    autowrite = 0
    staged = 0
    for f in findings:
        try:
            confidence = float(f.get("confidence") or 0.0)
            category = f.get("category") or "uncategorized"
            key = f.get("key") or "unspecified"
            value = f.get("value") or {}
            if confidence >= CONFIDENCE_AUTOWRITE_THRESHOLD:
                await write_finding(
                    entity_type="student",
                    entity_id=session["student_id"],
                    memory_category=category,
                    memory_key=key,
                    memory_value=value,
                    confidence_score=confidence,
                )
                autowrite += 1
            else:
                await stage_memory_proposal(
                    source_session_id=session_id,
                    entity_type="student",
                    entity_id=session["student_id"],
                    memory_category=category,
                    memory_key=key,
                    memory_value=value,
                    confidence_score=confidence,
                )
                staged += 1
        except Exception as e:
            print(f"   ⚠️ Failed to apply finding {f}: {e}")

    print(f"   📥 Memory loop: {autowrite} auto-written, {staged} staged for review")

    # 5) Reflection metric (uses existing pattern)
    await store_performance_metric(
        agent_type="session_assessor",
        evaluation={
            "overall_score": overall_score,
            "criteria": {
                "engagement": {"score": overall_score, "reasoning": "Overall engagement score"},
            },
            "weaknesses": [s.get("theme") for s in parsed.get("struggles", [])],
            "improvements": parsed.get("recommendations"),
        },
        session_id=str(assessment_id),
    )

    # 6) Mark session assessed
    supabase.table("lesson_sessions").update({
        "status": "assessed",
        "updated_at": datetime.now().isoformat(),
    }).eq("id", session_id).execute()

    print(f"   ✅ Assessment {assessment_id} stored. Overall engagement: {overall_score:.1f}/10")

    return {
        "assessment_id": str(assessment_id),
        "session_id": session_id,
        "assessment": assessment_record,
        "memory_findings": {
            "auto_written": autowrite,
            "staged": staged,
            "raw": findings,
        },
        "student": student,
        "tutor": tutor,
    }
