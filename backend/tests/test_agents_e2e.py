"""
End-to-end agent tests with a fake Supabase client and Gemini stubs.

Each test exercises one agent's full code path: load context → call AI →
parse → write back to DB → memory loop where applicable.
"""

import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytest


# ============================================================================
# Phase 1 — standards aligner
# ============================================================================

@pytest.mark.asyncio
async def test_standards_aligner_seeds_and_aligns(fake_db, gemini, seed):
    from agents.standards_aligner import align_lesson_to_standards

    lesson_id = str(uuid4())
    fake_db.table("lessons").insert({
        "id": lesson_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "Newton's Third Law", "content": {"sections": [{"phase": "Engage", "text": "rocket demo"}]},
    }).execute()

    # First Gemini call is Perplexity-style seeding (returns standards list)
    gemini.push({"standards": [
        {"code": "IGCSE.PHY.1.5", "description": "Forces — action and reaction", "parent_code": None},
        {"code": "IGCSE.PHY.1.6", "description": "Energy and work", "parent_code": None},
    ]})
    # Second call is the actual alignment
    gemini.push({"alignments": [
        {"code": "IGCSE.PHY.1.5", "alignment_strength": 0.92, "rationale": "Direct match"},
    ]})

    result = await align_lesson_to_standards(lesson_id)

    assert result["framework"] == "IGCSE"
    assert len(result["alignments"]) == 1
    assert result["alignments"][0]["code"] == "IGCSE.PHY.1.5"
    assert fake_db.table("curriculum_standards").rows  # seeded
    assert fake_db.table("lesson_standards").rows
    assert fake_db.table("agent_performance_metrics").rows  # reflection metric


@pytest.mark.asyncio
async def test_standards_aligner_handles_no_alignment(fake_db, gemini, seed):
    from agents.standards_aligner import align_lesson_to_standards

    lesson_id = str(uuid4())
    fake_db.table("lessons").insert({
        "id": lesson_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "Random topic", "content": {},
    }).execute()
    fake_db.table("curriculum_standards").insert({
        "framework": "IGCSE", "subject": "Physics", "grade_level": "10",
        "code": "IGCSE.PHY.1.5", "description": "Existing standard",
    }).execute()
    gemini.push({"alignments": []})

    result = await align_lesson_to_standards(lesson_id)
    assert result["alignments"] == []
    assert not fake_db.table("lesson_standards").rows


# ============================================================================
# Phase 2 — briefing agent
# ============================================================================

@pytest.mark.asyncio
async def test_briefing_agent_full(fake_db, gemini, seed):
    from agents.briefing_agent import generate_briefing

    # Seed a memory + a past assessment
    fake_db.table("platform_memory").insert({
        "entity_type": "student", "entity_id": seed["student_id"],
        "memory_category": "interest_signal", "memory_key": "aviation",
        "memory_value": {"summary": "loves rockets"}, "confidence_score": 0.85,
    }).execute()
    sess_id = str(uuid4())
    fake_db.table("lesson_sessions").insert({
        "id": sess_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "lesson_id": None, "status": "assessed", "created_at": datetime.utcnow().isoformat(),
    }).execute()
    fake_db.table("session_assessments").insert({
        "session_id": sess_id, "lesson_id": None, "overall_engagement_score": 6.5,
        "struggles": [{"theme": "action-reaction", "severity": "moderate", "evidence_quotes": ["they cancel"]}],
        "recommendations": "Scaffold the system boundary concept.",
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    gemini.push({
        "headline": "Alex needs scaffolding on Newton's 3rd law.",
        "remember": [{"point": "Confused action/reaction", "evidence": "they cancel"}],
        "watch_for": [{"signal": "says cancel", "what_to_do": "redirect to system boundary"}],
        "open_questions": ["Did the rocket activity click?"],
        "lesson_anchor_to_interest": "Connect to space exploration.",
        "warm_up_question": "When you push a wall, what pushes back?",
    })

    result = await generate_briefing(seed["student_id"], seed["tutor_id"])
    assert result["briefing_id"]
    assert "Alex" in result["content"]["headline"]
    assert len(result["content"]["remember"]) == 1
    rows = fake_db.table("pre_session_briefings").rows
    assert len(rows) == 1


# ============================================================================
# Phase 3 — voice memo agent
# ============================================================================

@pytest.mark.asyncio
async def test_voice_memo_extracts_and_tier_writes(fake_db, gemini, seed):
    from agents.voice_memo_agent import process_voice_memo

    memo_id = str(uuid4())
    # Stash audio in fake storage
    fake_db.storage.from_("session-media").upload(f"{seed['tutor_id']}/memos/{memo_id}.webm", b"FAKEBYTES")
    fake_db.table("voice_memos").insert({
        "id": memo_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "media_url": f"{seed['tutor_id']}/memos/{memo_id}.webm",
        "status": "pending", "created_at": datetime.utcnow().isoformat(),
    }).execute()

    gemini.push({
        "transcript": "Alex was distracted today, said his uncle is an engineer.",
        "language": "en",
        "findings": [
            {"category": "interest_signal", "key": "uncle_engineer",
             "value": {"summary": "Uncle is an engineer", "evidence_quote": "uncle is an engineer"},
             "confidence": 0.9},
            {"category": "engagement_pattern", "key": "tuesday_low",
             "value": {"summary": "Distracted Tuesday", "evidence_quote": "distracted today"},
             "confidence": 0.6},
        ],
    })

    result = await process_voice_memo(memo_id)
    assert result["applied"]["auto_written"] == 1
    assert result["applied"]["staged"] == 1
    # Auto-write went to platform_memory
    pm = fake_db.table("platform_memory").rows
    assert any(r["memory_key"] == "uncle_engineer" for r in pm)
    # Staged proposal
    mp = fake_db.table("memory_proposals").rows
    assert any(r["memory_key"] == "tuesday_low" for r in mp)
    # Memo marked done
    memo = fake_db.table("voice_memos").rows[0]
    assert memo["status"] == "done"
    assert memo["transcript"]


# ============================================================================
# Phase 4 — homework generator
# ============================================================================

@pytest.mark.asyncio
async def test_homework_generator_creates_assignment(fake_db, gemini, seed):
    from agents.homework_generator import generate_homework

    gemini.push({
        "title": "Newton's 3rd Law practice",
        "items": [
            {"id": "q1", "prompt": "What's an action-reaction pair?", "answer": "Equal & opposite forces",
             "solution_steps": ["identify pair"], "difficulty": 3, "standard_code": None},
            {"id": "q2", "prompt": "Skater pushes wall", "answer": "Skater accelerates back",
             "solution_steps": ["pair forces"], "difficulty": 4, "standard_code": None},
        ],
    })
    result = await generate_homework(
        student_id=seed["student_id"], tutor_id=seed["tutor_id"],
        format="problem_set", item_count=2, difficulty_target=3,
    )
    assert result["assignment_id"]
    assert len(result["items"]) == 2
    assert fake_db.table("homework_assignments").rows


# ============================================================================
# Phase 4 — homework checker (typed only)
# ============================================================================

@pytest.mark.asyncio
async def test_homework_checker_typed(fake_db, gemini, seed):
    from agents.homework_checker import check_homework

    asg_id = str(uuid4())
    fake_db.table("homework_assignments").insert({
        "id": asg_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "Test HW", "format": "problem_set", "status": "submitted",
        "content": {"items": [
            {"id": "q1", "prompt": "Action-reaction?", "answer": "equal opposite", "difficulty": 3},
            {"id": "q2", "prompt": "Net force on skater?", "answer": "non-zero, away from wall", "difficulty": 4},
        ]},
    }).execute()
    sub_id = str(uuid4())
    fake_db.table("homework_submissions").insert({
        "id": sub_id, "assignment_id": asg_id, "submission_type": "typed",
        "media_urls": [], "typed_answers": {"q1": "equal and opposite forces", "q2": "they cancel out"},
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    # Grading response
    gemini.push({
        "ocr_text": "",
        "graded_results": [
            {"item_id": "q1", "correct": True, "student_answer_excerpt": "equal and opposite",
             "feedback": "Right!", "misconception_theme": None, "confidence": 0.9},
            {"item_id": "q2", "correct": False, "student_answer_excerpt": "they cancel out",
             "feedback": "Forces act on different objects.", "misconception_theme": "third_law_cancellation",
             "confidence": 0.85},
        ],
        "overall_score": 50,
        "feedback_markdown": "Solid on q1. For q2…",
    })
    # Integrity check response
    gemini.push({"ai_likelihood": 0.1, "signals": ["matches typical voice"], "recommendation": "no_concern"})

    result = await check_homework(sub_id)
    assert result["overall_score"] == 50
    assert result["memory"]["auto_written"] == 1  # the wrong answer with conf 0.85 → auto-write
    assert result["integrity_check"]["recommendation"] == "no_concern"
    # Assignment marked graded
    asg = fake_db.table("homework_assignments").rows[0]
    assert asg["status"] == "graded"
    # Misconception memory present
    pm = fake_db.table("platform_memory").rows
    assert any(r["memory_key"] == "third_law_cancellation" for r in pm)


# ============================================================================
# Phase 5 — misconception detector (3+ events threshold)
# ============================================================================

@pytest.mark.asyncio
async def test_misconception_detector_threshold(fake_db, gemini, seed):
    from agents.misconception_detector import detect_misconceptions

    # 3 sessions with the same struggle theme
    for i in range(3):
        sid = str(uuid4())
        fake_db.table("lesson_sessions").insert({
            "id": sid, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
            "lesson_id": None, "status": "assessed",
            "created_at": (datetime.utcnow() - timedelta(days=i)).isoformat(),
        }).execute()
        fake_db.table("session_assessments").insert({
            "session_id": sid, "lesson_id": None, "overall_engagement_score": 5.0,
            "struggles": [{"theme": "Newton 3rd law cancellation", "severity": "moderate",
                            "evidence_quotes": [f"they cancel #{i}"]}],
            "created_at": (datetime.utcnow() - timedelta(days=i)).isoformat(),
        }).execute()

    result = await detect_misconceptions(seed["student_id"], lookback_days=30)
    assert result["events_seen"] == 3
    assert len(result["detected"]) == 1
    # Persistent misconception memory written
    pm = fake_db.table("platform_memory").rows
    assert any(r["memory_category"] == "persistent_misconception" for r in pm)
    # Notification fired for the tutor
    notif = fake_db.table("notifications").rows
    assert any(n["category"] == "misconception_detected" for n in notif)


@pytest.mark.asyncio
async def test_misconception_detector_below_threshold(fake_db, gemini, seed):
    from agents.misconception_detector import detect_misconceptions

    sid = str(uuid4())
    fake_db.table("lesson_sessions").insert({
        "id": sid, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "lesson_id": None, "status": "assessed", "created_at": datetime.utcnow().isoformat(),
    }).execute()
    fake_db.table("session_assessments").insert({
        "session_id": sid, "lesson_id": None, "overall_engagement_score": 5.0,
        "struggles": [{"theme": "Same theme", "severity": "moderate", "evidence_quotes": ["foo"]}],
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    result = await detect_misconceptions(seed["student_id"], lookback_days=30)
    # 1 event < threshold of 3 → no detected clusters
    assert result["detected"] == []


# ============================================================================
# Phase 6 — difficulty calibrator (deterministic, no LLM)
# ============================================================================

@pytest.mark.asyncio
async def test_difficulty_calibrator(fake_db, seed):
    from agents.difficulty_calibrator import calibrate_difficulty

    asg_id = str(uuid4())
    fake_db.table("homework_assignments").insert({
        "id": asg_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "HW", "format": "problem_set", "status": "graded",
        "content": {"items": [
            {"id": "q1", "difficulty": 1}, {"id": "q2", "difficulty": 2},
            {"id": "q3", "difficulty": 3}, {"id": "q4", "difficulty": 4},
            {"id": "q5", "difficulty": 5},
        ]},
    }).execute()
    fake_db.table("homework_submissions").insert({
        "id": str(uuid4()), "assignment_id": asg_id, "submission_type": "typed",
        "graded_results": [
            {"item_id": "q1", "correct": True}, {"item_id": "q2", "correct": True},
            {"item_id": "q3", "correct": True},                     # 100% at level 3
            {"item_id": "q4", "correct": "partial"},                # 50% at level 4
            {"item_id": "q5", "correct": False},                    # 0% at level 5
        ],
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    result = await calibrate_difficulty(seed["student_id"])
    band = result["band"]
    # Highest level with rate >= 0.70 is level 3 (100%)
    assert band["target"] == 3
    assert band["low"] == 2
    assert band["max"] == 4
    # Memory written
    pm = fake_db.table("platform_memory").rows
    assert any(r["memory_category"] == "difficulty_band" and r["memory_key"] == "current" for r in pm)


# ============================================================================
# Phase 7 — language adapter
# ============================================================================

@pytest.mark.asyncio
async def test_language_adapter_creates_version(fake_db, gemini, seed):
    from agents.language_adapter import adapt_lesson

    lesson_id = str(uuid4())
    fake_db.table("lessons").insert({
        "id": lesson_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "Newton's 3rd Law", "content": {"text": "Forces come in pairs"},
    }).execute()
    gemini.push({
        "title_translated": "قانون نيوتن الثالث",
        "scope": "difficult_only",
        "language": "ar",
        "content_translated": {"text": "القوى تأتي في أزواج"},
        "glossary": [{"term_target": "قوة", "term_english": "force", "definition": "push or pull"}],
    })
    result = await adapt_lesson(lesson_id, target_language="ar", scope="difficult_only", tutor_id=seed["tutor_id"])
    assert result["version_number"] == 1
    versions = fake_db.table("content_versions").rows
    assert len(versions) == 1
    assert versions[0]["edit_type"] == "ai_iteration"
    assert "ar" in versions[0]["edit_notes"]


# ============================================================================
# Phase 8 — integrity check
# ============================================================================

@pytest.mark.asyncio
async def test_integrity_check_typed_advisory(fake_db, gemini, seed):
    from agents.integrity_check import check_submission_integrity

    asg_id = str(uuid4())
    fake_db.table("homework_assignments").insert({
        "id": asg_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "HW", "format": "problem_set", "status": "graded", "content": {"items": []},
    }).execute()
    sub_id = str(uuid4())
    fake_db.table("homework_submissions").insert({
        "id": sub_id, "assignment_id": asg_id, "submission_type": "typed",
        "typed_answers": {"q1": "Utilizing the empirical paradigm of stochastic systems..."},
        "created_at": datetime.utcnow().isoformat(),
    }).execute()
    gemini.push({"ai_likelihood": 0.85, "signals": ["grade-inappropriate vocab"], "recommendation": "flag"})

    result = await check_submission_integrity(sub_id)
    assert result["recommendation"] == "flag"
    assert result["ai_likelihood"] == 0.85
    sub = fake_db.table("homework_submissions").rows[0]
    assert sub["integrity_check"]["recommendation"] == "flag"


@pytest.mark.asyncio
async def test_integrity_check_skips_photo_only(fake_db, seed):
    from agents.integrity_check import check_submission_integrity

    asg_id = str(uuid4())
    fake_db.table("homework_assignments").insert({
        "id": asg_id, "tutor_id": seed["tutor_id"], "student_id": seed["student_id"],
        "title": "HW", "format": "problem_set", "status": "graded", "content": {"items": []},
    }).execute()
    sub_id = str(uuid4())
    fake_db.table("homework_submissions").insert({
        "id": sub_id, "assignment_id": asg_id, "submission_type": "photo",
        "media_urls": ["fake.jpg"], "typed_answers": None,
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    result = await check_submission_integrity(sub_id)
    assert result["recommendation"] == "no_concern"
    assert result.get("skipped_reason") == "photo-only submission"


# ============================================================================
# Notifications service
# ============================================================================

@pytest.mark.asyncio
async def test_notification_create_list_read(fake_db, seed):
    from services import notification_service as nsvc

    nid = await nsvc.create(
        recipient_tutor_id=seed["tutor_id"], category="briefing_ready",
        title="Briefing ready", body="open it", link="/today", priority="high",
    )
    assert nid

    unread = await nsvc.list_unread(seed["tutor_id"])
    assert len(unread) == 1
    assert unread[0]["priority"] == "high"

    await nsvc.mark_read(nid)
    unread2 = await nsvc.list_unread(seed["tutor_id"])
    assert unread2 == []


# ============================================================================
# Reflection metrics — every agent records one
# ============================================================================

@pytest.mark.asyncio
async def test_reflection_metrics_recorded_for_new_agents(fake_db, gemini, seed):
    """After running a few agents, each one must appear in agent_performance_metrics."""
    from agents.briefing_agent import generate_briefing
    from agents.homework_generator import generate_homework
    from agents.difficulty_calibrator import calibrate_difficulty

    gemini.push({"headline": "h", "remember": [], "watch_for": [], "open_questions": [],
                  "lesson_anchor_to_interest": "", "warm_up_question": ""})
    await generate_briefing(seed["student_id"], seed["tutor_id"])

    gemini.push({"title": "t", "items": [{"id": "q1", "prompt": "p", "answer": "a", "difficulty": 3}]})
    await generate_homework(seed["student_id"], seed["tutor_id"], format="problem_set", item_count=1)

    await calibrate_difficulty(seed["student_id"])

    types = {m["agent_type"] for m in fake_db.table("agent_performance_metrics").rows}
    assert "briefing_agent" in types
    assert "homework_generator" in types
    assert "difficulty_calibrator" in types
