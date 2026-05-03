"""Tiny shared helpers used across the new toolkit agents.

Kept deliberately minimal — only true cross-agent utilities live here.
"""

import json
import re
from typing import Any, Dict


def parse_json_strict(response: str) -> Dict[str, Any]:
    """Pull a JSON object out of a Gemini response, tolerating code fences.

    Raises ValueError if no object can be found. Use parse_json_safe() if you'd
    rather get a fallback.
    """
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    raw = re.search(r"\{.*\}", response, re.DOTALL)
    if raw:
        return json.loads(raw.group(0))
    raise ValueError("No JSON object found in model response")


def parse_json_safe(response: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return parse_json_strict(response)
    except Exception:
        return dict(fallback)


def truncate(text: str, max_chars: int) -> str:
    if not text:
        return ""
    return text if len(text) <= max_chars else text[: max_chars - 3] + "..."
