"""
Homework Checker Agent

Grades a submission. Inputs:
  - photos (one or more) of handwritten work → multi-image OCR + grading via Gemini
  - typed answers (per item id) → text-only grading
  - mixed (both)

Output: per-item correctness + per-item feedback + overall_score + a
student-facing feedback markdown. Wrong-answer themes feed memory_proposals
(confidence-tiered like every other agent). Triggers integrity_check on typed
content.
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

import weave

from db.supabase_client import supabase
from services.ai_service import call_gemini, call_gemini_with_images
from services.agent_helpers import parse_json_strict, parse_json_safe, truncate
from services.memory_service import (
    write_finding,
    stage_memory_proposal,
    store_performance_metric,
)
from agents.integrity_check import check_submission_integrity

CONFIDENCE_AUTOWRITE_THRESHOLD = 0.8
HOMEWORK_BUCKET = "homework-media"


def _items_block(items: List[Dict[str, Any]]) -> str:
    out = []
    for it in items:
        out.append(
            f"  ITEM {it.get('id')}: {it.get('prompt')}\n"
            f"    Expected answer: {truncate(str(it.get('answer','')), 400)}\n"
            f"    Difficulty: {it.get('difficulty')}/5"
        )
    return "\n".join(out)


def _typed_block(typed: Optional[Dict[str, Any]]) -> str:
    if not typed:
        return "  (none)"
    return "\n".join(f"  ITEM {k}: {str(v)[:1200]}" for k, v in typed.items())


def _build_grading_prompt(student: Dict[str, Any], items: List[Dict[str, Any]],
                          typed: Optional[Dict[str, Any]], has_photos: bool) -> str:
    photos_clause = (
        "Photos of the student's handwritten work are attached. OCR them carefully (preserve math notation), "
        "then grade against the items below. Put the OCR text in `ocr_text`."
        if has_photos else
        "No photos. Grade the typed answers below."
    )
    return f"""You are grading homework for a {student.get('grade')} grade student in {student.get('subject')}.

{photos_clause}

ASSIGNMENT ITEMS (with expected answers):
{_items_block(items)}

TYPED ANSWERS (where provided):
{_typed_block(typed)}

Return ONLY valid JSON:
{{
  "ocr_text": "<verbatim OCR if photos were attached, else empty string>",
  "graded_results": [
    {{
      "item_id": "q1",
      "correct": true | false | "partial",
      "student_answer_excerpt": "<short verbatim excerpt of what the student wrote>",
      "feedback": "<one specific sentence — what was right or what to fix>",
      "misconception_theme": "<short snake_case theme if wrong, else null>",
      "confidence": <0.0-1.0 in your grading>
    }}
  ],
  "overall_score": <0-100 numeric percent>,
  "feedback_markdown": "<student-facing markdown — warm, specific, strengths first, max 200 words>"
}}

Rules:
- Use "partial" generously when the approach is right but the answer is incomplete.
- "feedback_markdown" is for the STUDENT — encouraging, no jargon, includes ONE concrete next step.
- Cite student's own words in `student_answer_excerpt` (not invented).
- If a photo is unreadable, set the matching item's `correct` to "partial" and note in feedback.
- If you can't tell whether an answer is right (ambiguous prompt), say so in feedback and mark "partial" with confidence ≤ 0.5.
"""


@weave.op()
async def check_homework(submission_id: str) -> Dict[str, Any]:
    sub_row = supabase.table("homework_submissions").select("*").eq("id", submission_id).limit(1).execute()
    if not sub_row.data:
        raise ValueError(f"Submission {submission_id} not found")
    submission = sub_row.data[0]

    asg = supabase.table("homework_assignments").select("*").eq("id", submission["assignment_id"]).limit(1).execute()
    if not asg.data:
        raise ValueError(f"Assignment {submission['assignment_id']} not found")
    assignment = asg.data[0]
    items = (assignment.get("content") or {}).get("items") or []

    student_row = supabase.table("students").select("*").eq("id", assignment["student_id"]).limit(1).execute()
    student = student_row.data[0] if student_row.data else {"grade": "?", "subject": "?", "name": "the student"}

    media_urls: List[str] = submission.get("media_urls") or []
    typed: Dict[str, Any] = submission.get("typed_answers") or {}

    images: List[Dict[str, Any]] = []
    for path in media_urls[:6]:  # cap at 6 photos
        try:
            data = await asyncio.to_thread(
                lambda p=path: supabase.storage.from_(HOMEWORK_BUCKET).download(p)
            )
            if data:
                lower = path.lower()
                mime = "image/jpeg"
                if lower.endswith(".png"):
                    mime = "image/png"
                elif lower.endswith(".webp"):
                    mime = "image/webp"
                elif lower.endswith(".heic") or lower.endswith(".heif"):
                    mime = "image/heic"
                images.append({"bytes": data, "mime_type": mime})
        except Exception as e:
            print(f"[homework_checker] failed to download {path}: {e}")

    has_photos = bool(images)
    if not has_photos and not typed:
        raise ValueError("Submission has neither photos nor typed answers")

    prompt = _build_grading_prompt(student, items, typed, has_photos)

    if has_photos:
        response = await call_gemini_with_images(
            prompt=prompt, images=images, temperature=0.3, max_tokens=4500,
        )
    else:
        response = await call_gemini(prompt, temperature=0.3, max_tokens=4500)

    try:
        parsed = parse_json_strict(response)
    except Exception:
        parsed = parse_json_safe(response, fallback={
            "ocr_text": "",
            "graded_results": [{"item_id": it.get("id"), "correct": "partial",
                                 "student_answer_excerpt": "", "feedback": "Auto-grading parse failed; review manually.",
                                 "misconception_theme": None, "confidence": 0.3}
                                for it in items],
            "overall_score": 0,
            "feedback_markdown": "Couldn't parse the auto-grading. Please review manually.",
        })

    # Sanity-clamp overall_score
    try:
        overall = max(0.0, min(100.0, float(parsed.get("overall_score") or 0.0)))
    except (TypeError, ValueError):
        overall = 0.0

    update = {
        "ocr_text": parsed.get("ocr_text") or None,
        "graded_results": parsed.get("graded_results") or [],
        "overall_score": overall,
        "feedback_markdown": parsed.get("feedback_markdown") or "",
        "graded_at": datetime.now().isoformat(),
    }
    supabase.table("homework_submissions").update(update).eq("id", submission_id).execute()
    supabase.table("homework_assignments").update({"status": "graded"}).eq("id", assignment["id"]).execute()

    # Wrong-answer themes → memory loop (confidence-tiered)
    autowrite = 0
    staged = 0
    for r in update["graded_results"]:
        theme = r.get("misconception_theme")
        if not theme:
            continue
        if r.get("correct") in (True, "true"):
            continue
        conf = float(r.get("confidence") or 0.0)
        if conf < 0.4:
            continue
        value = {
            "summary": f"Item {r.get('item_id')}: {truncate(r.get('feedback') or '', 180)}",
            "evidence_quote": truncate(r.get("student_answer_excerpt") or "", 200),
            "source": f"homework:{assignment['id']}",
        }
        try:
            if conf >= CONFIDENCE_AUTOWRITE_THRESHOLD:
                await write_finding(
                    entity_type="student", entity_id=assignment["student_id"],
                    memory_category="misconception", memory_key=theme,
                    memory_value=value, confidence_score=conf,
                )
                autowrite += 1
            else:
                await stage_memory_proposal(
                    source_session_id=None, entity_type="student",
                    entity_id=assignment["student_id"], memory_category="misconception",
                    memory_key=theme, memory_value=value, confidence_score=conf,
                )
                staged += 1
        except Exception as e:
            print(f"[homework_checker] memory write failed: {e}")

    # Integrity check (advisory) — only meaningful for typed
    integrity = None
    if typed:
        try:
            integrity = await check_submission_integrity(submission_id)
        except Exception as e:
            print(f"[homework_checker] integrity check failed: {e}")

    await store_performance_metric(
        agent_type="homework_checker",
        evaluation={
            "overall_score": min(10.0, overall / 10.0 + 5.0) / 1.0,  # not the student's score; agent's confidence
            "criteria": {"items_graded": {"score": min(10.0, len(update["graded_results"])),
                                          "reasoning": f"graded {len(update['graded_results'])} items"}},
        },
        session_id=submission_id,
    )

    return {
        "submission_id": submission_id,
        "overall_score": overall,
        "graded_results": update["graded_results"],
        "feedback_markdown": update["feedback_markdown"],
        "ocr_text": update["ocr_text"],
        "memory": {"auto_written": autowrite, "staged": staged},
        "integrity_check": integrity,
    }
