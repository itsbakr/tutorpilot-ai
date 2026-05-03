"""
Language Adapter

Adapts a lesson into a student's L1, either fully or just on the difficult
sections. Produces a new content_versions row (edit_type='ai_iteration') so it
slots into the existing lesson version-history UI without new tables.
"""

import json
from datetime import datetime
from typing import Any, Dict, Literal, Optional
from uuid import UUID

import weave

from db.supabase_client import supabase
from services.ai_service import call_gemini
from services.agent_helpers import parse_json_safe
from services.memory_service import store_performance_metric


@weave.op()
async def adapt_lesson(
    lesson_id: str,
    target_language: str,
    scope: Literal["difficult_only", "full"] = "difficult_only",
    add_glossary: bool = True,
    tutor_id: Optional[str] = None,
) -> Dict[str, Any]:
    lesson_row = supabase.table("lessons").select("*").eq("id", lesson_id).limit(1).execute()
    if not lesson_row.data:
        raise ValueError(f"Lesson {lesson_id} not found")
    lesson = lesson_row.data[0]
    content = lesson.get("content") or {}
    title = lesson.get("title") or "Untitled lesson"

    payload_str = json.dumps(content, ensure_ascii=False)[:6000]
    glossary_clause = (
        "Include a `glossary` field: a list of {term_in_target_language, term_in_english, brief_definition} "
        "for the 5-10 most important terms a student would need to bridge between languages."
        if add_glossary else
        "Do NOT add a glossary (caller asked to skip)."
    )
    scope_clause = (
        "Translate ONLY the conceptually difficult sections (the heart of the lesson, not the boilerplate); "
        "keep simple instructions and headers in English. Use the structure key 'sections_translated' to mark which were translated."
        if scope == "difficult_only" else
        "Translate the ENTIRE lesson content, preserving structure."
    )

    prompt = f"""You are adapting a tutoring lesson to a student's first language.

LESSON TITLE: {title}

ORIGINAL LESSON CONTENT (JSON):
{payload_str}

TARGET LANGUAGE: {target_language}
SCOPE: {scope}

{scope_clause}
{glossary_clause}

Return ONLY valid JSON (no markdown fences) of this shape:
{{
  "title_translated": "<title in {target_language}>",
  "scope": "{scope}",
  "language": "{target_language}",
  "content_translated": <original content shape, with translated text in difficult sections>,
  "glossary": [{{"term_target":"<...>","term_english":"<...>","definition":"<short>"}}]
}}

Rules:
- Preserve mathematical/scientific notation as-is.
- Do not invent content; if a section was clear in the original, it stays clear in the translation.
- For RTL languages (Arabic, Hebrew, Urdu, etc.) write naturally — the rendering layer handles `dir`.
"""
    response = await call_gemini(prompt, temperature=0.4, max_tokens=6000)
    parsed = parse_json_safe(response, fallback={
        "title_translated": title, "scope": scope, "language": target_language,
        "content_translated": content, "glossary": [],
    })

    new_version_content = {
        **content,
        "language_adaptation": {
            "language": target_language,
            "scope": scope,
            "title_translated": parsed.get("title_translated"),
            "translated_content": parsed.get("content_translated"),
            "glossary": parsed.get("glossary") or [],
            "generated_at": datetime.now().isoformat(),
        },
    }

    # Reuse the existing content_versions infrastructure
    version_query = supabase.table("content_versions") \
        .select("version_number") \
        .eq("content_type", "lesson") \
        .eq("content_id", lesson_id) \
        .order("version_number", desc=True) \
        .limit(1) \
        .execute()
    current = version_query.data[0]["version_number"] if version_query.data else 0
    new_version = current + 1

    version_row = {
        "content_type": "lesson",
        "content_id": lesson_id,
        "version_number": new_version,
        "content": new_version_content,
        "changes_summary": f"Language adaptation to {target_language} ({scope})",
        "edited_by": tutor_id or lesson.get("tutor_id"),
        "edit_type": "ai_iteration",
        "edit_notes": f"language_adapter: {target_language} / {scope}",
    }
    res = supabase.table("content_versions").insert(version_row).execute()
    version_id = res.data[0]["id"] if res.data else None

    await store_performance_metric(
        agent_type="language_adapter",
        evaluation={
            "overall_score": 7.0,
            "criteria": {"glossary_size": {"score": min(10.0, len(parsed.get("glossary") or []) * 1.5),
                                            "reasoning": f"{len(parsed.get('glossary') or [])} glossary terms"}},
        },
        session_id=str(version_id) if version_id else lesson_id,
    )

    return {
        "lesson_id": lesson_id,
        "version_id": version_id,
        "version_number": new_version,
        "language": target_language,
        "scope": scope,
        "glossary": parsed.get("glossary") or [],
    }
