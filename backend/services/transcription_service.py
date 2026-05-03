"""
Transcription Service

Pluggable session-source layer. The MVP source uses manual file upload
(stored in Supabase Storage) and Gemini 3.0 Flash multimodal for a single-pass
diarized transcript with emotion tags. A Recall.ai source can be added later
as another implementation of the same Protocol without touching the assessor.
"""

import json
import re
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

import weave

from db.supabase_client import supabase
from services.ai_service import call_gemini_multimodal, upload_gemini_file


# Inline-data limit chosen below the 20MB Gemini cap to leave headroom for the prompt.
INLINE_AUDIO_LIMIT_BYTES = 18 * 1024 * 1024
SUPABASE_STORAGE_BUCKET = "session-media"


@runtime_checkable
class SessionSource(Protocol):
    """Adapter interface for getting a transcript for a given session."""

    async def fetch_transcript(self, session_id: str) -> Dict[str, Any]:
        """Return a dict shaped like the session_transcripts row (without id)."""
        ...


def _build_transcription_prompt() -> str:
    return """You are an expert tutoring-session analyst. The attached audio is a one-on-one tutoring session between a TUTOR (adult) and a STUDENT (child or teenager).

Your task: produce a fully diarized transcript with emotion tags.

Heuristics for speaker_role:
- The TUTOR usually asks open-ended questions, gives explanations, scaffolds.
- The STUDENT usually answers shorter, may pause, may say "I don't know", may ask clarification.
- If a voice is clearly an adult vs. a child, use that. If genuinely ambiguous, use "unknown".

Heuristics for emotion (per utterance):
- engaged | curious | confident | confused | frustrated | disengaged | anxious | encouraged | neutral
- Base emotion on prosody (pace, energy, hesitation) AND content.

Return ONLY valid JSON (no commentary, no markdown fences) with this exact shape:
{
  "language": "<ISO-639-1 code, e.g. 'en' or 'ar'>",
  "summary": "<3-5 sentence neutral summary of what was covered>",
  "utterances": [
    {
      "speaker_role": "tutor" | "student" | "unknown",
      "start_ms": <integer>,
      "end_ms": <integer>,
      "text": "<verbatim utterance>",
      "emotion": "<one of the labels above>",
      "confidence": <0.0-1.0 confidence in speaker_role assignment>
    }
  ]
}

Be precise with timestamps. Preserve the original language; do NOT translate.
"""


def _extract_json(text: str) -> Dict[str, Any]:
    """Pull a JSON object out of a Gemini response, tolerating code fences."""
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    raw = re.search(r"\{.*\}", text, re.DOTALL)
    if raw:
        return json.loads(raw.group(0))
    raise ValueError("No JSON object found in Gemini response")


def _guess_mime_type(media_path: str) -> str:
    lower = media_path.lower()
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".m4a") or lower.endswith(".mp4"):
        return "audio/mp4"
    if lower.endswith(".webm"):
        return "audio/webm"
    if lower.endswith(".ogg"):
        return "audio/ogg"
    if lower.endswith(".flac"):
        return "audio/flac"
    return "audio/mpeg"


class ManualUploadGeminiSource:
    """MVP source: download the uploaded media from Supabase Storage, send to
    Gemini multimodal, and parse the diarized JSON output."""

    @weave.op()
    async def fetch_transcript(self, session_id: str) -> Dict[str, Any]:
        # Resolve the session row to find the storage path
        session_row = supabase.table("lesson_sessions") \
            .select("id, media_url") \
            .eq("id", session_id) \
            .limit(1) \
            .execute()

        if not session_row.data:
            raise ValueError(f"Session {session_id} not found")

        media_url = session_row.data[0].get("media_url")
        if not media_url:
            raise ValueError(f"Session {session_id} has no media_url to transcribe")

        # media_url is a storage object path within the session-media bucket.
        # Download bytes (sync supabase client → run in thread).
        media_bytes = await asyncio.to_thread(
            lambda: supabase.storage.from_(SUPABASE_STORAGE_BUCKET).download(media_url)
        )

        if not media_bytes:
            raise ValueError(f"Could not download media for session {session_id}")

        mime = _guess_mime_type(media_url)
        prompt = _build_transcription_prompt()

        # Pick inline vs Files API based on size
        if len(media_bytes) <= INLINE_AUDIO_LIMIT_BYTES:
            response_text = await call_gemini_multimodal(
                prompt=prompt,
                audio_bytes=media_bytes,
                audio_mime_type=mime,
                temperature=0.2,
                max_tokens=8000,
            )
        else:
            file_uri = await upload_gemini_file(media_bytes, mime, display_name=f"session-{session_id}")
            response_text = await call_gemini_multimodal(
                prompt=prompt,
                file_uri=file_uri,
                audio_mime_type=mime,
                temperature=0.2,
                max_tokens=8000,
            )

        parsed = _extract_json(response_text)
        utterances: List[Dict[str, Any]] = parsed.get("utterances", []) or []

        return {
            "session_id": session_id,
            "language": parsed.get("language"),
            "summary": parsed.get("summary"),
            "utterances": utterances,
            "raw_provider_response": {"text": response_text[:50000]},  # cap audit blob
        }


# Default source for the MVP. Swap to a different SessionSource (e.g. RecallAiSource)
# when integrating other capture providers; the assessor doesn't need to change.
default_source: SessionSource = ManualUploadGeminiSource()


@weave.op()
async def transcribe(session_id: str, source: Optional[SessionSource] = None) -> Dict[str, Any]:
    """Idempotent transcribe: skip if a transcript already exists for the session."""
    existing = supabase.table("session_transcripts") \
        .select("*") \
        .eq("session_id", session_id) \
        .limit(1) \
        .execute()

    if existing.data:
        print(f"   ↩︎ Reusing existing transcript for session {session_id}")
        return existing.data[0]

    src = source or default_source

    # Mark transcribing
    supabase.table("lesson_sessions").update({
        "status": "transcribing",
        "updated_at": datetime.now().isoformat(),
    }).eq("id", session_id).execute()

    try:
        result = await src.fetch_transcript(session_id)
    except Exception as e:
        supabase.table("lesson_sessions").update({
            "status": "failed",
            "status_error": f"transcription: {str(e)[:500]}",
            "updated_at": datetime.now().isoformat(),
        }).eq("id", session_id).execute()
        raise

    insert = {
        "session_id": session_id,
        "utterances": result["utterances"],
        "language": result.get("language"),
        "summary": result.get("summary"),
        "raw_provider_response": result.get("raw_provider_response"),
        "created_at": datetime.now().isoformat(),
    }
    inserted = supabase.table("session_transcripts").insert(insert).execute()

    supabase.table("lesson_sessions").update({
        "status": "transcribed",
        "updated_at": datetime.now().isoformat(),
    }).eq("id", session_id).execute()

    print(f"   ✅ Transcribed session {session_id}: {len(result['utterances'])} utterances, lang={result.get('language')}")
    return inserted.data[0] if inserted.data else insert
