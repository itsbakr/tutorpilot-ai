"""
Voice Memo Agent

30s tutor monologue → transcript + 2-5 memory findings, tier-applied.
Lighter than session_assessor: no diarization, no lesson comparison, just
"what did the tutor just say about this student that we should remember?"
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

import weave

from db.supabase_client import supabase
from services.ai_service import call_gemini_multimodal, upload_gemini_file
from services.agent_helpers import parse_json_safe
from services.memory_service import (
    write_finding,
    stage_memory_proposal,
    store_performance_metric,
)
from services.transcription_service import (
    SUPABASE_STORAGE_BUCKET,
    INLINE_AUDIO_LIMIT_BYTES,
    _guess_mime_type,
)

CONFIDENCE_AUTOWRITE_THRESHOLD = 0.8


def _build_memo_prompt(student_label: str) -> str:
    target = f"the student {student_label}" if student_label else "no specific student (tutor-level note)"
    return f"""The attached audio is a short voice memo by a tutor about {target}.

Transcribe it, then extract durable memory findings about the student (or the tutor's practice if no student is named).

Return ONLY valid JSON, no markdown fences:
{{
  "transcript": "<verbatim, in original language>",
  "language": "<ISO-639-1>",
  "findings": [
    {{
      "category": "engagement_pattern" | "learning_preference" | "interest_signal" | "confidence_signal" | "misconception" | "tutor_observation",
      "key": "<short snake_case stable identifier>",
      "value": {{ "summary": "<one sentence>", "evidence_quote": "<verbatim quote from memo>" }},
      "confidence": <0.0-1.0>
    }}
  ]
}}

Rules:
- Aim for 2-5 findings. If the memo is non-substantive (e.g. "test test"), return an empty findings list.
- Every finding MUST cite an evidence_quote drawn from the transcript.
- Confidence: 0.85+ if the tutor was definite ("Alex is fascinated by aviation"); 0.5-0.7 if hedged or one-time observation.
"""


@weave.op()
async def process_voice_memo(memo_id: str) -> Dict[str, Any]:
    """Download memo audio, transcribe, extract findings, apply confidence-tiered writeback."""
    row = supabase.table("voice_memos").select("*").eq("id", memo_id).limit(1).execute()
    if not row.data:
        raise ValueError(f"Voice memo {memo_id} not found")
    memo = row.data[0]

    student_label = ""
    if memo.get("student_id"):
        s = supabase.table("students").select("name").eq("id", memo["student_id"]).limit(1).execute()
        if s.data:
            student_label = s.data[0]["name"]

    supabase.table("voice_memos").update({"status": "processing"}).eq("id", memo_id).execute()

    try:
        media_bytes = await asyncio.to_thread(
            lambda: supabase.storage.from_(SUPABASE_STORAGE_BUCKET).download(memo["media_url"])
        )
        if not media_bytes:
            raise ValueError("Could not download voice memo audio")

        mime = _guess_mime_type(memo["media_url"])
        prompt = _build_memo_prompt(student_label)

        if len(media_bytes) <= INLINE_AUDIO_LIMIT_BYTES:
            response = await call_gemini_multimodal(
                prompt=prompt, audio_bytes=media_bytes, audio_mime_type=mime,
                temperature=0.3, max_tokens=2000,
            )
        else:
            uri = await upload_gemini_file(media_bytes, mime, display_name=f"memo-{memo_id}")
            response = await call_gemini_multimodal(
                prompt=prompt, file_uri=uri, audio_mime_type=mime,
                temperature=0.3, max_tokens=2000,
            )

        parsed = parse_json_safe(response, fallback={"transcript": "", "language": None, "findings": []})

    except Exception as e:
        supabase.table("voice_memos").update({
            "status": "failed", "status_error": str(e)[:500],
        }).eq("id", memo_id).execute()
        raise

    findings: List[Dict[str, Any]] = parsed.get("findings") or []
    autowrite = 0
    staged = 0
    if memo.get("student_id"):
        for f in findings:
            try:
                conf = float(f.get("confidence") or 0.0)
                cat = f.get("category") or "tutor_observation"
                key = f.get("key") or "unspecified"
                val = f.get("value") or {}
                if conf >= CONFIDENCE_AUTOWRITE_THRESHOLD:
                    await write_finding(
                        entity_type="student", entity_id=memo["student_id"],
                        memory_category=cat, memory_key=key, memory_value=val,
                        confidence_score=conf,
                    )
                    autowrite += 1
                else:
                    await stage_memory_proposal(
                        source_session_id=None, entity_type="student",
                        entity_id=memo["student_id"], memory_category=cat,
                        memory_key=key, memory_value=val, confidence_score=conf,
                    )
                    staged += 1
            except Exception as e:
                print(f"[voice_memo] finding apply failed: {e}")

    supabase.table("voice_memos").update({
        "transcript": parsed.get("transcript"),
        "status": "done",
    }).eq("id", memo_id).execute()

    await store_performance_metric(
        agent_type="voice_memo_agent",
        evaluation={
            "overall_score": min(10.0, 5.0 + len(findings)),
            "criteria": {"findings_count": {"score": min(10.0, 5.0 + len(findings)),
                                            "reasoning": f"{len(findings)} findings"}},
        },
        session_id=memo_id,
    )

    return {
        "memo_id": memo_id,
        "transcript": parsed.get("transcript"),
        "findings": findings,
        "applied": {"auto_written": autowrite, "staged": staged},
    }
