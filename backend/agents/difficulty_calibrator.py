"""
Difficulty Calibrator

Deterministic (no LLM). Reads homework_submissions.graded_results, computes
% correct per difficulty level, finds the band where 70-85% correct lands,
and writes a `difficulty_band` memory entry. homework_generator and
activity_creator (when extended) read this band to size future content.
"""

from typing import Any, Dict, List, Optional

import weave

from db.supabase_client import supabase
from services.memory_service import write_finding, store_performance_metric

PRODUCTIVE_LOW = 0.70
PRODUCTIVE_HIGH = 0.85


def _correct_value(c: Any) -> float:
    if c is True or c == "true":
        return 1.0
    if c == "partial":
        return 0.5
    return 0.0


@weave.op()
async def calibrate_difficulty(student_id: str) -> Dict[str, Any]:
    """Compute and persist the student's current productive-difficulty band."""
    asgs = supabase.table("homework_assignments").select("id, content").eq("student_id", student_id).execute()
    aid_to_items: Dict[str, Dict[str, int]] = {}
    for a in (asgs.data or []):
        items = (a.get("content") or {}).get("items") or []
        aid_to_items[a["id"]] = {str(it.get("id")): int(it.get("difficulty") or 3) for it in items}

    if not aid_to_items:
        return {"student_id": student_id, "band": None, "reason": "no homework yet"}

    subs = supabase.table("homework_submissions") \
        .select("assignment_id, graded_results") \
        .in_("assignment_id", list(aid_to_items.keys())) \
        .execute()

    by_difficulty: Dict[int, List[float]] = {1: [], 2: [], 3: [], 4: [], 5: []}
    for sub in (subs.data or []):
        diff_map = aid_to_items.get(sub["assignment_id"], {})
        for r in (sub.get("graded_results") or []):
            d = diff_map.get(str(r.get("item_id")))
            if d is None:
                continue
            d = max(1, min(5, int(d)))
            by_difficulty[d].append(_correct_value(r.get("correct")))

    rates: Dict[int, Optional[float]] = {}
    for d in (1, 2, 3, 4, 5):
        scores = by_difficulty[d]
        rates[d] = (sum(scores) / len(scores)) if scores else None

    # Find target = highest difficulty where rate is still in productive zone (>= PRODUCTIVE_LOW)
    target = None
    for d in (5, 4, 3, 2, 1):
        if rates[d] is not None and rates[d] >= PRODUCTIVE_LOW:
            target = d
            break
    if target is None:
        # Student struggles at every level we have data for; pick the lowest level where we have data
        observed = [d for d in (1, 2, 3, 4, 5) if rates[d] is not None]
        target = observed[0] if observed else 2

    low = max(1, target - 1)
    cap = min(5, target + 1)

    band = {"low": low, "target": target, "max": cap,
            "rates_by_difficulty": {str(k): (round(v, 3) if v is not None else None) for k, v in rates.items()}}

    await write_finding(
        entity_type="student", entity_id=student_id,
        memory_category="difficulty_band", memory_key="current",
        memory_value=band, confidence_score=0.9,
    )

    await store_performance_metric(
        agent_type="difficulty_calibrator",
        evaluation={
            "overall_score": 8.0,
            "criteria": {"target_difficulty": {"score": float(target * 2), "reasoning": f"target={target}"}},
        },
        session_id=student_id,
    )

    return {"student_id": student_id, "band": band}
