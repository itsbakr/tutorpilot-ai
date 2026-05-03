"""
Homework Generator Agent

Generates a worksheet / problem set / reading / reflection for a student tied
to a lesson. Items carry difficulty (1-5), an answer, solution_steps, and
a standard code if available. Difficulty target is auto-adjusted by the
difficulty_calibrator's stored band when present.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import weave

from db.supabase_client import supabase, get_student
from services.ai_service import call_gemini
from services.agent_helpers import parse_json_strict, parse_json_safe
from services.memory_service import (
    load_student_memories,
    store_performance_metric,
)
from agents.standards_aligner import get_lesson_standards


def _difficulty_band_from_memory(memories: List[Dict[str, Any]]) -> Optional[Dict[str, int]]:
    for m in memories:
        if m.get("memory_category") == "difficulty_band" and m.get("memory_key") == "current":
            v = m.get("memory_value") or {}
            return {"low": int(v.get("low", 1)), "target": int(v.get("target", 3)), "max": int(v.get("max", 5))}
    return None


@weave.op()
async def generate_homework(
    student_id: str,
    tutor_id: str,
    lesson_id: Optional[str] = None,
    format: str = "problem_set",
    item_count: int = 5,
    difficulty_target: Optional[int] = None,
    title: Optional[str] = None,
    due_at: Optional[str] = None,
    estimated_duration_minutes: int = 20,
    focus_standard_code: Optional[str] = None,
) -> Dict[str, Any]:
    if format not in ("worksheet", "problem_set", "reading", "reflection"):
        raise ValueError(f"Invalid format: {format}")
    if item_count < 1 or item_count > 30:
        raise ValueError("item_count must be between 1 and 30")

    student = await get_student(student_id)
    if not student:
        raise ValueError(f"Student {student_id} not found")

    memories = await load_student_memories(student_id, limit=10)
    band = _difficulty_band_from_memory(memories)
    if difficulty_target is None:
        difficulty_target = band["target"] if band else 3

    lesson = None
    standards: List[Dict[str, Any]] = []
    if lesson_id:
        l = supabase.table("lessons").select("*").eq("id", lesson_id).limit(1).execute()
        if l.data:
            lesson = l.data[0]
            standards = await get_lesson_standards(lesson_id)

    standards_block = "\n".join(f"  - {s['code']}: {s['description'][:160]}" for s in standards) or "  (none aligned)"
    focus_block = f"\nFOCUS STANDARD: {focus_standard_code}" if focus_standard_code else ""

    lesson_block = ""
    if lesson:
        snippet = json.dumps(lesson.get("content") or {}, ensure_ascii=False)[:2000]
        lesson_block = f"\nLESSON TITLE: {lesson.get('title')}\nLESSON PLAN (truncated):\n{snippet}\n"

    prompt = f"""You are designing homework for a student.

STUDENT: {student.get('name')}, grade {student.get('grade')}, subject {student.get('subject')}
Interests: {', '.join(student.get('interests') or [])}
Learning style: {student.get('learning_style')}

DIFFICULTY TARGET: {difficulty_target}/5 (productive struggle zone)
{f"DIFFICULTY BAND: low={band['low']}, target={band['target']}, max={band['max']}" if band else ""}

FORMAT: {format}
ITEM COUNT: {item_count}
{lesson_block}
ALIGNED STANDARDS:
{standards_block}{focus_block}

Return ONLY valid JSON:
{{
  "title": "<short title>",
  "items": [
    {{
      "id": "q1",
      "prompt": "<the question or task>",
      "answer": "<expected answer; for reflections, expected themes>",
      "solution_steps": ["<step 1>","<step 2>"],
      "difficulty": <1-5 integer>,
      "standard_code": "<one of the aligned codes, or null>"
    }}
  ]
}}

Rules:
- Mix difficulties around the target; AT LEAST ONE item should be exactly at the target.
- Connect at least one item to a student interest where natural.
- For "reading", items are reading-comprehension prompts; "answer" is the model answer.
- For "reflection", items are open-ended; "answer" is what a strong response would touch on.
- Numerical/scientific notation is fine; LaTeX in $...$ if needed.
"""

    response = await call_gemini(prompt, temperature=0.7, max_tokens=4000)
    try:
        parsed = parse_json_strict(response)
    except Exception as e:
        # One retry with a stricter "RETURN ONLY JSON" suffix
        response = await call_gemini(prompt + "\n\nRETURN ONLY THE JSON OBJECT. No prose.", temperature=0.5, max_tokens=4000)
        parsed = parse_json_safe(response, fallback={"title": "Homework", "items": []})

    items = parsed.get("items") or []
    if not items:
        raise ValueError("Homework generation produced no items")

    asg_id = uuid4()
    record = {
        "id": str(asg_id),
        "tutor_id": tutor_id,
        "student_id": student_id,
        "lesson_id": lesson_id,
        "title": title or parsed.get("title") or f"{format.replace('_',' ').title()} for {student.get('name')}",
        "format": format,
        "content": {"items": items},
        "estimated_duration_minutes": estimated_duration_minutes,
        "standards": [s["code"] for s in standards] if standards else [],
        "status": "assigned",
        "due_at": due_at,
        "created_at": datetime.now().isoformat(),
    }
    supabase.table("homework_assignments").insert(record).execute()

    avg_diff = sum(int(i.get("difficulty") or 3) for i in items) / max(1, len(items))
    await store_performance_metric(
        agent_type="homework_generator",
        evaluation={
            "overall_score": 7.5,
            "criteria": {
                "items_count": {"score": min(10.0, len(items) * 1.5), "reasoning": f"{len(items)} items"},
                "avg_difficulty_match": {"score": max(1.0, 10.0 - abs(avg_diff - difficulty_target) * 2), "reasoning": f"avg={avg_diff:.1f} vs target={difficulty_target}"},
            },
        },
        session_id=str(asg_id),
    )

    return {"assignment_id": str(asg_id), "title": record["title"], "items": items, "standards": record["standards"]}
