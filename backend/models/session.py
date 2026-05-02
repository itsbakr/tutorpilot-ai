"""Session, Assessment, and Parent Feedback Models"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from uuid import UUID


class Utterance(BaseModel):
    speaker_role: Literal["tutor", "student", "unknown"]
    start_ms: int
    end_ms: int
    text: str
    emotion: Optional[str] = None
    confidence: Optional[float] = None


class SessionTranscript(BaseModel):
    id: UUID
    session_id: UUID
    utterances: List[Utterance]
    language: Optional[str] = None
    summary: Optional[str] = None
    created_at: Optional[str] = None


class LessonSessionCreate(BaseModel):
    student_id: UUID
    tutor_id: UUID
    lesson_id: Optional[UUID] = None
    source: Literal["manual_upload", "recall_ai", "google_meet", "browser_ext"] = "manual_upload"
    source_metadata: Optional[Dict[str, Any]] = None
    occurred_at: Optional[str] = None


class LessonSession(BaseModel):
    id: UUID
    student_id: UUID
    tutor_id: UUID
    lesson_id: Optional[UUID] = None
    source: str
    source_metadata: Optional[Dict[str, Any]] = None
    media_url: Optional[str] = None
    media_duration_seconds: Optional[int] = None
    status: Literal["pending", "transcribing", "transcribed", "assessing", "assessed", "failed"]
    status_error: Optional[str] = None
    occurred_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ObjectiveScore(BaseModel):
    objective: str
    score: float = Field(ge=0, le=10)
    status: Literal["mastered", "progressing", "struggling", "not_addressed"]
    evidence_quotes: List[str] = Field(default_factory=list)


class StrengthFinding(BaseModel):
    theme: str
    evidence_quotes: List[str] = Field(default_factory=list)


class StruggleFinding(BaseModel):
    theme: str
    severity: Literal["minor", "moderate", "significant"]
    evidence_quotes: List[str] = Field(default_factory=list)
    suggested_next_step: str


class EmotionalArcEntry(BaseModel):
    phase: str  # e.g. "opening", "main_concept", "practice", "closing"
    dominant_emotion: str
    note: Optional[str] = None


class LessonCoverage(BaseModel):
    planned_phases_covered: List[str] = Field(default_factory=list)
    skipped: List[str] = Field(default_factory=list)
    unplanned_topics: List[str] = Field(default_factory=list)


class SessionAssessment(BaseModel):
    id: Optional[UUID] = None
    session_id: UUID
    lesson_id: Optional[UUID] = None
    overall_engagement_score: float = Field(ge=0, le=10)
    objective_scores: List[ObjectiveScore] = Field(default_factory=list)
    strengths: List[StrengthFinding] = Field(default_factory=list)
    struggles: List[StruggleFinding] = Field(default_factory=list)
    emotional_arc: List[EmotionalArcEntry] = Field(default_factory=list)
    lesson_coverage: Optional[LessonCoverage] = None
    recommendations: Optional[str] = None
    created_at: Optional[str] = None


class MemoryProposal(BaseModel):
    id: Optional[UUID] = None
    source_session_id: Optional[UUID] = None
    entity_type: str
    entity_id: UUID
    memory_category: str
    memory_key: str
    memory_value: Dict[str, Any]
    confidence_score: float = Field(ge=0, le=1)
    status: Literal["pending", "approved", "rejected"] = "pending"
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[str] = None
    created_at: Optional[str] = None


class ParentFeedbackReport(BaseModel):
    id: Optional[UUID] = None
    tutor_id: UUID
    student_id: UUID
    mode: Literal["per_session", "weekly_digest"]
    session_ids: List[UUID]
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    content: Dict[str, Any]
    status: Literal["draft", "tutor_edited", "shared"] = "draft"
    tutor_edits: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
