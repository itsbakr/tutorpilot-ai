"""
Standards Aligner Agent

For each lesson, finds the 1-3 best-aligned curriculum standards in the tutor's
framework (IGCSE / IB / CBSE / Common Core / A-Levels). Standards are seeded
lazily on first use of a (framework, subject, grade) triple via Perplexity.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

import weave

from db.supabase_client import supabase, get_tutor
from services.ai_service import call_gemini, call_perplexity
from services.agent_helpers import parse_json_strict
from services.memory_service import store_performance_metric


def _normalize_framework(value: Optional[str]) -> str:
    if not value:
        return "CUSTOM"
    upper = value.upper().strip()
    mapping = {
        "IGCSE": "IGCSE", "IB": "IB_DP", "IB DP": "IB_DP", "IB_DP": "IB_DP",
        "CBSE": "CBSE", "COMMON CORE": "COMMON_CORE", "COMMON_CORE": "COMMON_CORE",
        "A-LEVELS": "A_LEVELS", "A LEVELS": "A_LEVELS", "GENERAL": "CUSTOM",
    }
    return mapping.get(upper, upper.replace(" ", "_").replace("-", "_"))


@weave.op()
async def _seed_standards_if_missing(framework: str, subject: str, grade: Optional[str]) -> List[Dict[str, Any]]:
    """If we have no standards for this (framework, subject, grade), fetch them via Perplexity."""
    existing = supabase.table("curriculum_standards") \
        .select("*") \
        .eq("framework", framework) \
        .eq("subject", subject) \
        .eq("grade_level", grade or "") \
        .execute()
    if existing.data:
        return existing.data

    grade_clause = f" grade {grade}" if grade else ""
    prompt = (
        f"List the official curriculum standards for {framework}{grade_clause} {subject}. "
        f"Return ONLY valid JSON of the form "
        f'{{"standards":[{{"code":"<short stable code>","description":"<full standard text>","parent_code":"<optional parent>"}}]}}.'
        f" Aim for 8-25 standards. Use the official codes when known."
    )
    try:
        result = await call_perplexity(prompt, temperature=0.1, max_tokens=3000)
        parsed = parse_json_strict(result.get("content", "{}"))
    except Exception as e:
        print(f"[standards_aligner] seeding failed for {framework}/{subject}/{grade}: {e}")
        return []

    rows: List[Dict[str, Any]] = []
    sources = result.get("sources") or []
    src_url = sources[0].get("url") if sources else None
    for s in parsed.get("standards", []):
        code = (s.get("code") or "").strip()
        desc = (s.get("description") or "").strip()
        if not code or not desc:
            continue
        rows.append({
            "framework": framework,
            "subject": subject,
            "grade_level": grade or "",
            "code": code,
            "description": desc,
            "parent_code": s.get("parent_code"),
            "source_url": src_url,
            "created_at": datetime.now().isoformat(),
        })
    if not rows:
        return []
    try:
        supabase.table("curriculum_standards").upsert(rows, on_conflict="framework,code").execute()
    except Exception as e:
        print(f"[standards_aligner] insert standards failed: {e}")
    refetch = supabase.table("curriculum_standards") \
        .select("*") \
        .eq("framework", framework) \
        .eq("subject", subject) \
        .eq("grade_level", grade or "") \
        .execute()
    return refetch.data or []


def _format_lesson_for_alignment(lesson: Dict[str, Any]) -> str:
    title = lesson.get("title") or ""
    content = lesson.get("content") or {}
    if isinstance(content, dict):
        snippet = str(content)[:3500]
    else:
        snippet = str(content)[:3500]
    return f"TITLE: {title}\nCONTENT (truncated):\n{snippet}"


def _format_standards_list(standards: List[Dict[str, Any]]) -> str:
    return "\n".join(
        f"- {s['code']}: {s['description'][:200]}" for s in standards[:60]
    )


@weave.op()
async def align_lesson_to_standards(lesson_id: str) -> Dict[str, Any]:
    """Align a lesson to 1-3 of its tutor's curriculum standards."""
    lesson_row = supabase.table("lessons").select("*").eq("id", lesson_id).limit(1).execute()
    if not lesson_row.data:
        raise ValueError(f"Lesson {lesson_id} not found")
    lesson = lesson_row.data[0]

    tutor = await get_tutor(lesson["tutor_id"])
    student_row = supabase.table("students").select("subject, grade").eq("id", lesson["student_id"]).limit(1).execute()
    student = student_row.data[0] if student_row.data else {}

    framework = _normalize_framework((tutor or {}).get("education_system"))
    subject = student.get("subject") or "General"
    grade = student.get("grade")

    standards = await _seed_standards_if_missing(framework, subject, grade)
    if not standards:
        return {"lesson_id": lesson_id, "alignments": [], "framework": framework, "skipped": True}

    prompt = (
        f"You are aligning a tutoring lesson to {framework} {subject}"
        f"{' grade ' + grade if grade else ''} standards.\n\n"
        f"LESSON:\n{_format_lesson_for_alignment(lesson)}\n\n"
        f"CANDIDATE STANDARDS:\n{_format_standards_list(standards)}\n\n"
        f"Return ONLY valid JSON: "
        f'{{"alignments":[{{"code":"<code>","alignment_strength":<0-1>,"rationale":"<one sentence>"}}]}}.'
        f" Pick 1-3 strongest. Be honest — if nothing aligns above 0.4, return an empty list."
    )
    response = await call_gemini(prompt, temperature=0.3, max_tokens=900)
    try:
        parsed = parse_json_strict(response)
    except Exception as e:
        print(f"[standards_aligner] parse failed: {e}")
        parsed = {"alignments": []}

    by_code = {s["code"]: s for s in standards}
    rows = []
    for a in parsed.get("alignments", [])[:3]:
        std = by_code.get((a.get("code") or "").strip())
        if not std:
            continue
        rows.append({
            "lesson_id": lesson_id,
            "standard_id": std["id"],
            "alignment_strength": float(a.get("alignment_strength") or 0.0),
            "rationale": a.get("rationale"),
        })

    if rows:
        # Wipe prior alignments for this lesson, then insert fresh.
        supabase.table("lesson_standards").delete().eq("lesson_id", lesson_id).execute()
        supabase.table("lesson_standards").insert(rows).execute()

    avg_strength = sum(r["alignment_strength"] for r in rows) / len(rows) if rows else 0.0
    await store_performance_metric(
        agent_type="standards_aligner",
        evaluation={
            "overall_score": round(avg_strength * 10, 2),
            "criteria": {"alignment_strength": {"score": round(avg_strength * 10, 2), "reasoning": f"avg over {len(rows)} matches"}},
        },
        session_id=lesson_id,
    )
    return {
        "lesson_id": lesson_id,
        "framework": framework,
        "alignments": [
            {"code": by_code[r["standard_id"]]["code"] if False else next((s["code"] for s in standards if s["id"] == r["standard_id"]), ""),
             "alignment_strength": r["alignment_strength"],
             "rationale": r["rationale"]}
            for r in rows
        ],
    }


async def get_lesson_standards(lesson_id: str) -> List[Dict[str, Any]]:
    """Return the standards aligned to a lesson, joined for display."""
    res = supabase.table("lesson_standards") \
        .select("alignment_strength, rationale, curriculum_standards(code, description, framework)") \
        .eq("lesson_id", lesson_id) \
        .execute()
    out = []
    for row in res.data or []:
        std = row.get("curriculum_standards") or {}
        out.append({
            "code": std.get("code"),
            "description": std.get("description"),
            "framework": std.get("framework"),
            "alignment_strength": row.get("alignment_strength"),
            "rationale": row.get("rationale"),
        })
    return out


async def student_standards_coverage(student_id: str) -> Dict[str, Any]:
    """Aggregate coverage across all lessons for a student.

    Returns: { standards: [{code, description, taught_count, avg_objective_score, status}] }
    where status ∈ {"never","taught","struggling","mastered"}.
    """
    lessons = supabase.table("lessons") \
        .select("id") \
        .eq("student_id", student_id) \
        .execute()
    lesson_ids = [l["id"] for l in (lessons.data or [])]
    if not lesson_ids:
        return {"standards": []}

    aligns = supabase.table("lesson_standards") \
        .select("lesson_id, standard_id, alignment_strength, curriculum_standards(code, description)") \
        .in_("lesson_id", lesson_ids) \
        .execute()
    if not aligns.data:
        return {"standards": []}

    by_standard: Dict[str, Dict[str, Any]] = {}
    for r in aligns.data:
        sid = r["standard_id"]
        std = (r.get("curriculum_standards") or {})
        entry = by_standard.setdefault(sid, {
            "code": std.get("code"),
            "description": std.get("description"),
            "taught_count": 0,
            "lesson_ids": [],
            "scores": [],
        })
        entry["taught_count"] += 1
        entry["lesson_ids"].append(r["lesson_id"])

    # Pull objective_scores from session_assessments for these lessons
    sessions = supabase.table("lesson_sessions") \
        .select("id, lesson_id") \
        .in_("lesson_id", list({lid for entry in by_standard.values() for lid in entry["lesson_ids"]})) \
        .execute()
    session_ids = [s["id"] for s in (sessions.data or [])]
    if session_ids:
        assessments = supabase.table("session_assessments") \
            .select("session_id, objective_scores") \
            .in_("session_id", session_ids) \
            .execute()
        # Best effort: map each assessment to all standards aligned to its lesson
        sess_to_lesson = {s["id"]: s["lesson_id"] for s in (sessions.data or [])}
        lesson_to_standards: Dict[str, List[str]] = {}
        for sid, entry in by_standard.items():
            for lid in entry["lesson_ids"]:
                lesson_to_standards.setdefault(lid, []).append(sid)
        for a in (assessments.data or []):
            obj = a.get("objective_scores") or []
            avg_obj = (
                sum(float(o.get("score", 0)) for o in obj) / len(obj)
                if obj else None
            )
            if avg_obj is None:
                continue
            for std_id in lesson_to_standards.get(sess_to_lesson.get(a["session_id"]), []):
                by_standard[std_id]["scores"].append(avg_obj)

    out = []
    for entry in by_standard.values():
        scores = entry.pop("scores")
        avg = sum(scores) / len(scores) if scores else None
        status = "taught"
        if avg is not None:
            if avg >= 8.0:
                status = "mastered"
            elif avg < 6.0:
                status = "struggling"
        entry["avg_objective_score"] = avg
        entry["status"] = status
        out.append(entry)
    out.sort(key=lambda x: (x["status"] != "struggling", -x["taught_count"]))
    return {"standards": out}
