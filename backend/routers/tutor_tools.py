"""
Tutor AI Tools router.

Implements:
- 1.2 Saved prompts
- 1.3 Voice transcription (Whisper)
- 2.2 Sessions + events + analytics + AI summary
- 2.3 Cross-student remix
- 3.1 Misconception detector
- 3.2 Parent recap
- 3.3 Alignment checker (SSE)
- 3.4 Activity versions

Mounted from main.py via `app.include_router(...)`.
"""

import asyncio
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import Client

from services.ai_service import call_gemini

router = APIRouter()


def _supabase() -> Client:
    """Lazy-import to avoid circular dependency with main.py."""
    from main import supabase
    return supabase


# ─── Pydantic models ──────────────────────────────────────────────────────────

class SavedPromptCreate(BaseModel):
    label: str
    prompt: str

class SavedPromptUpdate(BaseModel):
    label: Optional[str] = None
    prompt: Optional[str] = None

class SessionStart(BaseModel):
    activity_id: str
    student_id: Optional[str] = None
    tutor_id: Optional[str] = None

class SessionEventBatch(BaseModel):
    events: List[Dict[str, Any]]

class VersionLabel(BaseModel):
    label: Optional[str] = None

class VersionPin(BaseModel):
    student_id: Optional[str] = None

class AdaptRequest(BaseModel):
    source_activity_id: str
    target_student_id: str
    tutor_id: str

class RecapRequest(BaseModel):
    student_id: str
    from_date: str
    to_date: str
    tone: Optional[str] = "warm"

class AlignmentRequest(BaseModel):
    student_id: str
    standard_id: Optional[str] = None


# ─── 1.2 Saved prompts ────────────────────────────────────────────────────────

@router.get("/api/v1/tutor/{tutor_id}/saved-prompts")
async def list_saved_prompts(tutor_id: str):
    res = _supabase().table("tutor_saved_prompts") \
        .select("*") \
        .eq("tutor_id", tutor_id) \
        .order("use_count", desc=True) \
        .order("created_at", desc=True) \
        .execute()
    return {"prompts": res.data or []}


@router.post("/api/v1/tutor/{tutor_id}/saved-prompts")
async def create_saved_prompt(tutor_id: str, body: SavedPromptCreate):
    res = _supabase().table("tutor_saved_prompts").insert({
        "tutor_id": tutor_id,
        "label": body.label[:80],
        "prompt": body.prompt,
    }).execute()
    return {"prompt": res.data[0] if res.data else None}


@router.patch("/api/v1/tutor/saved-prompts/{prompt_id}")
async def update_saved_prompt(prompt_id: str, body: SavedPromptUpdate):
    update: Dict[str, Any] = {}
    if body.label is not None:
        update["label"] = body.label[:80]
    if body.prompt is not None:
        update["prompt"] = body.prompt
    if not update:
        raise HTTPException(400, "No fields to update")
    res = _supabase().table("tutor_saved_prompts") \
        .update(update).eq("id", prompt_id).execute()
    return {"prompt": res.data[0] if res.data else None}


@router.delete("/api/v1/tutor/saved-prompts/{prompt_id}")
async def delete_saved_prompt(prompt_id: str):
    _supabase().table("tutor_saved_prompts").delete().eq("id", prompt_id).execute()
    return {"success": True}


@router.post("/api/v1/tutor/saved-prompts/{prompt_id}/use")
async def use_saved_prompt(prompt_id: str):
    sb = _supabase()
    res = sb.rpc("increment_saved_prompt_use", {"prompt_id": prompt_id}).execute()
    next_count = res.data if isinstance(res.data, int) else (res.data or 0)
    return {"success": True, "use_count": next_count}


# ─── 1.3 Voice transcription ──────────────────────────────────────────────────

@router.post("/api/v1/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe an uploaded audio file via OpenAI Whisper.

    Requires OPENAI_API_KEY. Returns ``{"text": "..."}``.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(503, "Transcription disabled (OPENAI_API_KEY not set)")

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        data = await audio.read()
        # OpenAI SDK accepts (filename, bytes, mime) tuple
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio.filename or "audio.webm", data, audio.content_type or "audio/webm"),
        )
        return {"text": getattr(result, "text", "")}
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)[:200]}")


# ─── 2.2 Sessions + events + analytics ────────────────────────────────────────

@router.post("/api/v1/sessions")
async def start_session(body: SessionStart):
    res = _supabase().table("activity_sessions").insert({
        "activity_id": body.activity_id,
        "student_id": body.student_id,
        "tutor_id": body.tutor_id,
    }).execute()
    return {"session": res.data[0] if res.data else None}


@router.post("/api/v1/sessions/{session_id}/events")
async def push_events(session_id: str, body: SessionEventBatch):
    if not body.events:
        return {"success": True, "count": 0}
    rows = [{
        "session_id": session_id,
        "kind": e.get("kind", "custom"),
        "payload": e.get("payload"),
    } for e in body.events]
    _supabase().table("activity_events").insert(rows).execute()
    return {"success": True, "count": len(rows)}


@router.post("/api/v1/sessions/{session_id}/end")
async def end_session(session_id: str):
    sb = _supabase()
    sess_res = sb.table("activity_sessions").select("*").eq("id", session_id).single().execute()
    if not sess_res.data:
        raise HTTPException(404, "Session not found")
    sess = sess_res.data

    started = sess.get("started_at")
    duration = None
    try:
        if started:
            t0 = datetime.fromisoformat(started.replace("Z", "+00:00"))
            duration = int((datetime.now(timezone.utc) - t0).total_seconds())
    except Exception:
        duration = None

    events_res = sb.table("activity_events").select("*").eq("session_id", session_id).order("ts").execute()
    events = events_res.data or []

    summary, misconceptions, strengths = await _summarize_session(sess, events)

    update = {
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration,
        "ai_summary": summary,
        "ai_misconceptions": misconceptions,
        "ai_strengths": strengths,
    }
    sb.table("activity_sessions").update(update).eq("id", session_id).execute()
    return {"session": {**sess, **update}}


async def _summarize_session(sess: Dict[str, Any], events: List[Dict[str, Any]]):
    if not events:
        return ("No interactions recorded.", [], [])

    # Keep the head (first interactions) and the tail (final answers + completion event),
    # which carry the most signal. Note any gap in the prompt so the model knows.
    MAX_HEAD = 100
    MAX_TAIL = 100
    truncated = False
    if len(events) > MAX_HEAD + MAX_TAIL:
        head = events[:MAX_HEAD]
        tail = events[-MAX_TAIL:]
        skipped = len(events) - MAX_HEAD - MAX_TAIL
        truncated = True
    else:
        head, tail, skipped = events, [], 0

    def fmt(e: Dict[str, Any]) -> str:
        return f"- [{e.get('ts', '')}] {e.get('kind')}: {json.dumps(e.get('payload') or {})}"

    head_lines = "\n".join(fmt(e) for e in head)
    tail_lines = "\n".join(fmt(e) for e in tail)
    event_lines = head_lines
    if truncated:
        event_lines += f"\n... [{skipped} middle events omitted] ...\n" + tail_lines

    truncation_note = (
        f"\n(Note: {skipped} events from the middle of the session were omitted; "
        "the first and last portions are shown above.)"
        if truncated else ""
    )

    prompt = f"""You are reviewing a student's session on an interactive tutoring activity.

EVENTS (chronological):
{event_lines}{truncation_note}

Return a JSON object with these keys:
- "summary": one short paragraph (≤80 words) describing how the session went.
- "misconceptions": array of objects {{"topic": "...", "evidence": "...", "remediation": "..."}}; can be empty.
- "strengths": array of objects {{"topic": "...", "evidence": "..."}}; can be empty.

Reply with ONLY the JSON object, no preamble."""
    try:
        text = await call_gemini(prompt, temperature=0.2, max_tokens=800)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
        obj = json.loads(text.strip())
        return (obj.get("summary", ""), obj.get("misconceptions", []), obj.get("strengths", []))
    except Exception as e:
        return (f"Could not summarize session: {str(e)[:100]}", [], [])


@router.get("/api/v1/sessions/{session_id}")
async def get_session(session_id: str):
    sb = _supabase()
    sess = sb.table("activity_sessions").select("*").eq("id", session_id).single().execute()
    events = sb.table("activity_events").select("*").eq("session_id", session_id).order("ts").execute()
    return {"session": sess.data, "events": events.data or []}


@router.get("/api/v1/activities/{activity_id}/sessions")
async def list_activity_sessions(activity_id: str):
    res = _supabase().table("activity_sessions") \
        .select("*").eq("activity_id", activity_id) \
        .order("started_at", desc=True).execute()
    return {"sessions": res.data or []}


@router.get("/api/v1/students/{student_id}/sessions")
async def list_student_sessions(student_id: str):
    res = _supabase().table("activity_sessions") \
        .select("*").eq("student_id", student_id) \
        .order("started_at", desc=True).execute()
    return {"sessions": res.data or []}


@router.get("/api/v1/activities/{activity_id}/analytics")
async def activity_analytics(activity_id: str):
    """Aggregate event data for charts."""
    sb = _supabase()
    sessions = sb.table("activity_sessions").select("id, duration_seconds, started_at") \
        .eq("activity_id", activity_id).execute().data or []
    if not sessions:
        return {"sessions_count": 0, "questions": [], "durations": [], "completion_rate": 0}

    session_ids = [s["id"] for s in sessions]
    events = sb.table("activity_events").select("*").in_("session_id", session_ids).execute().data or []

    by_question: Dict[str, Dict[str, int]] = {}
    completed = 0
    for e in events:
        kind = e.get("kind")
        payload = e.get("payload") or {}
        if kind == "answer":
            qid = str(payload.get("question_id") or payload.get("question") or "?")
            entry = by_question.setdefault(qid, {"correct": 0, "incorrect": 0, "hints": 0})
            if payload.get("correct"):
                entry["correct"] += 1
            else:
                entry["incorrect"] += 1
        elif kind == "hint":
            qid = str(payload.get("question_id") or "?")
            entry = by_question.setdefault(qid, {"correct": 0, "incorrect": 0, "hints": 0})
            entry["hints"] += 1
        elif kind == "completed":
            completed += 1

    questions = [{"id": qid, **stats} for qid, stats in by_question.items()]
    durations = [s.get("duration_seconds") for s in sessions if s.get("duration_seconds")]

    return {
        "sessions_count": len(sessions),
        "questions": questions,
        "durations": durations,
        "completion_rate": (completed / len(sessions)) if sessions else 0,
    }


# ─── 3.4 Activity versions ────────────────────────────────────────────────────

@router.get("/api/v1/activity/{activity_id}/versions")
async def list_versions(activity_id: str):
    res = _supabase().table("activity_versions") \
        .select("*").eq("activity_id", activity_id) \
        .order("version_number", desc=True).execute()
    return {"versions": res.data or []}


@router.patch("/api/v1/activity/versions/{version_id}")
async def label_version(version_id: str, body: VersionLabel):
    res = _supabase().table("activity_versions").update({
        "label": body.label,
    }).eq("id", version_id).execute()
    return {"version": res.data[0] if res.data else None}


@router.post("/api/v1/activity/versions/{version_id}/pin")
async def pin_version(version_id: str, body: VersionPin):
    sb = _supabase()
    # Unpin any other version pinned for this student on the same activity
    if body.student_id:
        v = sb.table("activity_versions").select("activity_id").eq("id", version_id).single().execute()
        if v.data:
            sb.table("activity_versions").update({"pinned_for_student_id": None}) \
                .eq("activity_id", v.data["activity_id"]) \
                .eq("pinned_for_student_id", body.student_id).execute()
    res = sb.table("activity_versions").update({
        "pinned_for_student_id": body.student_id,
    }).eq("id", version_id).execute()
    return {"version": res.data[0] if res.data else None}


@router.post("/api/v1/activity/versions/{version_id}/restore")
async def restore_version(version_id: str):
    sb = _supabase()
    v_res = sb.table("activity_versions").select("*").eq("id", version_id).single().execute()
    if not v_res.data:
        raise HTTPException(404, "Version not found")
    v = v_res.data

    activity_res = sb.table("activities").select("content").eq("id", v["activity_id"]).single().execute()
    current_content = (activity_res.data or {}).get("content") or {}

    sb.table("activities").update({
        "content": {**current_content, "code": v["code"]},
        "sandbox_url": v.get("sandbox_url"),
    }).eq("id", v["activity_id"]).execute()

    return {
        "activity_id": v["activity_id"],
        "code": v["code"],
        "sandbox_url": v.get("sandbox_url"),
    }


# Helper used by main.py's chat-stream endpoint to snapshot a new version
async def snapshot_version(
    activity_id: str,
    code: str,
    sandbox_url: Optional[str],
    tutor_id: Optional[str] = None,
    label: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    sb = _supabase()
    cur = sb.table("activity_versions").select("version_number") \
        .eq("activity_id", activity_id) \
        .order("version_number", desc=True).limit(1).execute()
    next_n = ((cur.data[0]["version_number"] if cur.data else 0) or 0) + 1
    res = sb.table("activity_versions").insert({
        "activity_id": activity_id,
        "version_number": next_n,
        "label": label,
        "code": code,
        "sandbox_url": sandbox_url,
        "created_by": tutor_id,
    }).execute()
    return res.data[0] if res.data else None


# ─── 2.3 Cross-student remix ──────────────────────────────────────────────────

@router.post("/api/v1/agents/activity/adapt")
async def adapt_activity(body: AdaptRequest):
    sb = _supabase()
    src = sb.table("activities").select("*").eq("id", body.source_activity_id).single().execute()
    if not src.data:
        raise HTTPException(404, "Source activity not found")

    target = sb.table("students").select("*").eq("id", body.target_student_id).single().execute()
    if not target.data:
        raise HTTPException(404, "Target student not found")

    src_code = (src.data.get("content") or {}).get("code", "")
    student_profile = json.dumps({
        "name": target.data.get("name"),
        "grade": target.data.get("grade"),
        "interests": target.data.get("interests"),
        "objectives": target.data.get("objectives"),
        "subject": target.data.get("subject"),
    }, indent=2)

    prompt = f"""You are adapting an existing React activity for a different student.

ORIGINAL ACTIVITY CODE:
```jsx
{src_code}
```

NEW STUDENT PROFILE:
{student_profile}

Rewrite the activity to fit this student. Preserve the learning objective and game mechanic.
Swap names, examples, vocabulary, and difficulty appropriately for the student's grade and interests.

Return ONLY the complete React component code in a ```jsx code block. No explanations."""

    try:
        from services.ai_service import call_gemini_coder
        from agents.activity_creator import deploy_to_daytona
    except Exception as e:
        raise HTTPException(500, f"Activity creator unavailable: {e}")

    new_code = await call_gemini_coder(prompt, temperature=0.3, max_tokens=9000)
    if "```" in new_code:
        new_code = new_code.split("```")[1]
        # Strip any common language fence tag (jsx/tsx/javascript/typescript/js/ts/react)
        # left at the start of the first line.
        new_code = re.sub(
            r"^(jsx|tsx|javascript|typescript|js|ts|react)\b[^\n]*\n?",
            "",
            new_code,
        )

    sandbox_url = None
    sandbox_id = None
    deployment_status = "pending"
    try:
        deployment = await deploy_to_daytona(new_code, body.target_student_id, max_attempts=1)
        sandbox_url = deployment.get("url")
        sandbox_id = deployment.get("sandbox_id")
        deployment_status = "success" if sandbox_url else "failed"
    except Exception as e:
        deployment_status = "failed"

    new_row = sb.table("activities").insert({
        "student_id": body.target_student_id,
        "tutor_id": body.tutor_id,
        "topic": src.data.get("topic"),
        "duration": src.data.get("duration"),
        "lesson_id": src.data.get("lesson_id"),
        "lesson_phase": src.data.get("lesson_phase"),
        "content": {"code": new_code, "topic": src.data.get("topic")},
        "code": new_code,
        "sandbox_url": sandbox_url,
        "sandbox_id": sandbox_id,
        "deployment_status": deployment_status,
        "parent_activity_id": body.source_activity_id,
    }).execute()

    return {
        "activity_id": new_row.data[0]["id"] if new_row.data else None,
        "sandbox_url": sandbox_url,
        "deployment_status": deployment_status,
    }


# ─── 3.1 Misconception detector ───────────────────────────────────────────────

@router.get("/api/v1/students/{student_id}/insights")
async def list_insights(student_id: str):
    res = _supabase().table("student_insights") \
        .select("*").eq("student_id", student_id) \
        .eq("dismissed", False) \
        .order("generated_at", desc=True).execute()
    return {"insights": res.data or []}


@router.post("/api/v1/students/{student_id}/insights/generate")
async def generate_insights(student_id: str):
    sb = _supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    sessions = sb.table("activity_sessions") \
        .select("id, activity_id, ai_summary, ai_misconceptions, ai_strengths, started_at") \
        .eq("student_id", student_id) \
        .gte("started_at", cutoff).execute().data or []

    if len(sessions) < 2:
        return {"insights": [], "reason": "need at least 2 sessions"}

    summaries = "\n".join([
        f"- {s['started_at']}: {s.get('ai_summary') or ''} | misconceptions={json.dumps(s.get('ai_misconceptions') or [])}"
        for s in sessions
    ])

    min_citations = min(2, len(sessions))
    prompt = f"""Across these recent sessions for one student, identify recurring misconceptions
(topics that appear in 2+ sessions) and durable strengths.

SESSIONS:
{summaries}

Return JSON: {{"insights": [{{"kind": "misconception"|"strength", "topic": "...", "evidence": [{{"session_id": "...", "quote": "..."}}], "recommended_action": "..."}}]}}.
Cite at least {min_citations} specific session(s) per insight; skip patterns without evidence.
Reply with ONLY the JSON."""

    try:
        text = await call_gemini(prompt, temperature=0.2, max_tokens=1200)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
        obj = json.loads(text.strip())
        new_rows = []
        for insight in obj.get("insights", []):
            row = sb.table("student_insights").insert({
                "student_id": student_id,
                "kind": insight.get("kind", "misconception"),
                "topic": insight.get("topic"),
                "evidence": insight.get("evidence"),
                "recommended_action": insight.get("recommended_action"),
            }).execute()
            if row.data:
                new_rows.append(row.data[0])
        return {"insights": new_rows}
    except Exception as e:
        raise HTTPException(500, f"Insight generation failed: {str(e)[:200]}")


@router.post("/api/v1/insights/{insight_id}/dismiss")
async def dismiss_insight(insight_id: str):
    _supabase().table("student_insights").update({"dismissed": True}).eq("id", insight_id).execute()
    return {"success": True}


# ─── 3.2 Parent recap ─────────────────────────────────────────────────────────

@router.post("/api/v1/students/{student_id}/recap")
async def generate_recap(student_id: str, body: RecapRequest):
    sb = _supabase()
    student = sb.table("students").select("name, grade").eq("id", student_id).single().execute()

    # Make to_date inclusive of the entire day: bump it to the start of the next day
    # and use a strict less-than. Falls back to raw value if parsing fails.
    to_exclusive = body.to_date
    try:
        to_dt = datetime.fromisoformat(body.to_date)
        to_exclusive = (to_dt + timedelta(days=1)).date().isoformat()
    except Exception:
        pass

    sessions = sb.table("activity_sessions") \
        .select("ai_summary, ai_strengths, ai_misconceptions, started_at") \
        .eq("student_id", student_id) \
        .gte("started_at", body.from_date) \
        .lt("started_at", to_exclusive).execute().data or []

    name = (student.data or {}).get("name", "the student")
    first_name = name.split()[0] if name else "the student"

    if not sessions:
        return {
            "subject": f"{first_name}: no recorded sessions",
            "body": "",
            "empty": True,
            "message": (
                f"There are no recorded sessions for {first_name} between "
                f"{body.from_date} and {body.to_date}. Try widening the date range "
                "or run a session in Student view first."
            ),
            "session_count": 0,
        }

    summaries_text = "\n".join([
        f"- {s.get('started_at')}: {s.get('ai_summary') or 'session'}"
        + (f" · strengths={json.dumps(s.get('ai_strengths') or [])}" if s.get('ai_strengths') else "")
        + (f" · misconceptions={json.dumps(s.get('ai_misconceptions') or [])}" if s.get('ai_misconceptions') else "")
        for s in sessions
    ])

    tone = "warm and personal" if body.tone == "warm" else "concise and businesslike"

    prompt = f"""Write a {tone} parent-facing recap for {first_name} covering {body.from_date} to {body.to_date}.
Include 2-3 highlights, 1 area for growth, and 1 thing to celebrate. Around 120 words.

SESSION DATA:
{summaries_text}

Return JSON: {{"subject": "...", "body": "..."}}.
Reply with ONLY the JSON."""

    try:
        text = await call_gemini(prompt, temperature=0.5, max_tokens=600)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
        obj = json.loads(text.strip())
        return {
            "subject": obj.get("subject", f"{first_name}'s recap"),
            "body": obj.get("body", ""),
            "empty": False,
            "session_count": len(sessions),
        }
    except Exception as e:
        raise HTTPException(500, f"Recap generation failed: {str(e)[:200]}")


# ─── 3.3 Alignment checker (SSE) ──────────────────────────────────────────────

@router.get("/api/v1/curriculum-standards")
async def list_standards():
    res = _supabase().table("curriculum_standards").select("*").order("code").execute()
    return {"standards": res.data or []}


@router.post("/api/v1/activity/{activity_id}/check-alignment")
async def check_alignment(activity_id: str, body: AlignmentRequest):
    sb = _supabase()
    activity = sb.table("activities").select("content, topic").eq("id", activity_id).single().execute()
    if not activity.data:
        raise HTTPException(404, "Activity not found")
    code = (activity.data.get("content") or {}).get("code", "")[:6000]
    topic = activity.data.get("topic", "")

    student = sb.table("students").select("grade, objectives, subject") \
        .eq("id", body.student_id).single().execute()
    student_data = student.data or {}

    standard = None
    if body.standard_id:
        s_res = sb.table("curriculum_standards").select("*").eq("id", body.standard_id).single().execute()
        standard = s_res.data

    async def run_check(axis: str, prompt: str) -> Dict[str, Any]:
        try:
            text = await call_gemini(prompt, temperature=0.2, max_tokens=400)
            text = text.strip()
            if text.startswith("```"):
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
            obj = json.loads(text.strip())
            return {
                "axis": axis,
                "status": obj.get("status", "warn"),
                "reasoning": obj.get("reasoning", ""),
            }
        except Exception as e:
            return {"axis": axis, "status": "warn", "reasoning": f"Could not check: {str(e)[:120]}"}

    age_prompt = f"""Is this React activity appropriate for a grade {student_data.get('grade', '?')} student?
TOPIC: {topic}
ACTIVITY CODE (truncated): {code}
Return JSON {{"status": "pass"|"warn"|"fail", "reasoning": "..."}}. Reply with ONLY JSON."""

    obj_prompt = f"""Does this activity align with the student's stated objectives?
OBJECTIVES: {student_data.get('objectives') or 'none'}
ACTIVITY CODE (truncated): {code}
Return JSON {{"status": "pass"|"warn"|"fail", "reasoning": "..."}}. Reply with ONLY JSON."""

    std_prompt = (
        f"""Does this activity align with the curriculum standard "{standard['code']}: {standard['description']}"?
ACTIVITY CODE (truncated): {code}
Return JSON {{"status": "pass"|"warn"|"fail", "reasoning": "..."}}. Reply with ONLY JSON."""
        if standard else None
    )

    async def event_stream():
        def sse(payload: Dict[str, Any]) -> str:
            return f"data: {json.dumps(payload)}\n\n"

        tasks = [
            asyncio.create_task(run_check("age", age_prompt)),
            asyncio.create_task(run_check("objectives", obj_prompt)),
        ]
        if std_prompt:
            tasks.append(asyncio.create_task(run_check("standard", std_prompt)))

        for fut in asyncio.as_completed(tasks):
            result = await fut
            yield sse(result)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
