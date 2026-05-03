"""
Integrity Check Agent

Advisory AI-detection on typed homework answers. Returns ai_likelihood (0-1)
and human-readable signals. Surfaced as a pill, NEVER auto-flagged to parents.
"""

from typing import Any, Dict, List, Optional

import weave

from db.supabase_client import supabase
from services.ai_service import call_gemini
from services.agent_helpers import parse_json_safe
from services.memory_service import store_performance_metric


def _format_typed(typed_answers: Optional[Dict[str, Any]]) -> str:
    if not typed_answers:
        return "(none)"
    return "\n".join(f"  • {k}: {str(v)[:600]}" for k, v in typed_answers.items())


def _format_priors(prior_submissions: List[Dict[str, Any]]) -> str:
    """Concatenate up to 3 prior typed answers from the same student for stylometric baseline."""
    if not prior_submissions:
        return "(no prior typed work — caution: lower confidence in stylometric signals)"
    lines = []
    for s in prior_submissions[:3]:
        ta = s.get("typed_answers") or {}
        for v in ta.values():
            lines.append(f"  • {str(v)[:400]}")
    return "\n".join(lines) or "(no prior typed work)"


@weave.op()
async def check_submission_integrity(submission_id: str) -> Dict[str, Any]:
    """Run an advisory integrity check; persists onto homework_submissions.integrity_check."""
    sub_row = supabase.table("homework_submissions").select("*").eq("id", submission_id).limit(1).execute()
    if not sub_row.data:
        raise ValueError(f"Submission {submission_id} not found")
    submission = sub_row.data[0]

    if submission.get("submission_type") == "photo":
        # Photos of handwritten work are inherently low-risk for AI text generation.
        result = {"ai_likelihood": 0.0, "signals": [], "recommendation": "no_concern",
                  "skipped_reason": "photo-only submission"}
        supabase.table("homework_submissions").update({"integrity_check": result}).eq("id", submission_id).execute()
        return result

    typed = submission.get("typed_answers") or {}
    if not typed:
        result = {"ai_likelihood": 0.0, "signals": [], "recommendation": "no_concern",
                  "skipped_reason": "no typed answers"}
        supabase.table("homework_submissions").update({"integrity_check": result}).eq("id", submission_id).execute()
        return result

    # Find priors from same student via the assignment join
    asg = supabase.table("homework_assignments").select("student_id, lesson_id").eq("id", submission["assignment_id"]).limit(1).execute()
    student_id = asg.data[0]["student_id"] if asg.data else None
    student = None
    priors: List[Dict[str, Any]] = []
    if student_id:
        s = supabase.table("students").select("name, grade, languages").eq("id", student_id).limit(1).execute()
        student = s.data[0] if s.data else None
        # Pull prior submissions for this student via assignments
        their_assignments = supabase.table("homework_assignments").select("id").eq("student_id", student_id).execute()
        their_ids = [a["id"] for a in (their_assignments.data or []) if a["id"] != submission["assignment_id"]]
        if their_ids:
            ps = supabase.table("homework_submissions") \
                .select("typed_answers") \
                .in_("assignment_id", their_ids) \
                .order("created_at", desc=True) \
                .limit(3) \
                .execute()
            priors = ps.data or []

    grade = (student or {}).get("grade") or "unknown"
    languages = ", ".join((student or {}).get("languages") or [])

    prompt = f"""You are evaluating whether a student's typed homework answers may have been written by AI.
This is ADVISORY only — your output is shown to the tutor as a pill, never auto-shared with parents.

STUDENT CONTEXT:
- Grade: {grade}
- Languages: {languages or 'unknown'}

PRIOR TYPED ANSWERS FROM THIS STUDENT (stylometric baseline):
{_format_priors(priors)}

CURRENT SUBMISSION TYPED ANSWERS:
{_format_typed(typed)}

Return ONLY valid JSON:
{{
  "ai_likelihood": <0.0-1.0>,
  "signals": ["<short observation 1>", "<short observation 2>", ...],
  "recommendation": "no_concern" | "discuss" | "flag"
}}

Calibration:
- 0.0-0.3 = no concern: matches student's prior writing voice + grade-appropriate vocab
- 0.3-0.6 = some signals: prefer "discuss"
- 0.6-1.0 = strong signals: prefer "flag" (still advisory)

Signals to look for: grade-inappropriate vocabulary, atypical sentence length, stylometric mismatch with priors, structural perfection, generic phrasing, hedging mid-sentence ("In conclusion, while it is true that…").

Be conservative — students DO grow; don't flag growth. If you have no priors to compare, say so honestly in the signals and cap likelihood at 0.5.
"""

    response = await call_gemini(prompt, temperature=0.3, max_tokens=900)
    parsed = parse_json_safe(response, fallback={
        "ai_likelihood": 0.0, "signals": ["integrity check parse failed; review manually"],
        "recommendation": "no_concern",
    })
    parsed["ai_likelihood"] = max(0.0, min(1.0, float(parsed.get("ai_likelihood") or 0.0)))
    if parsed.get("recommendation") not in ("no_concern", "discuss", "flag"):
        parsed["recommendation"] = "no_concern"

    supabase.table("homework_submissions").update({"integrity_check": parsed}).eq("id", submission_id).execute()

    await store_performance_metric(
        agent_type="integrity_check",
        evaluation={
            "overall_score": 5.0,  # neutral — this agent doesn't have a "right answer" to grade
            "criteria": {"ran": {"score": 5.0, "reasoning": f"likelihood={parsed['ai_likelihood']}"}},
        },
        session_id=submission_id,
    )
    return parsed
