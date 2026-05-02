-- ============================================================================
-- Migration: Feedback Assessment & Generation Agents
-- Adds session capture, transcription, assessment, parent reports, memory proposals
-- ============================================================================

-- A real session that occurred (vs. lessons table = the plan)
CREATE TABLE IF NOT EXISTS lesson_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES tutors(id),
  student_id uuid REFERENCES students(id),
  lesson_id uuid REFERENCES lessons(id),
  source varchar NOT NULL DEFAULT 'manual_upload'
    CHECK (source IN ('manual_upload','recall_ai','google_meet','browser_ext')),
  source_metadata jsonb,
  media_url text,
  media_duration_seconds integer,
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','transcribing','transcribed','assessing','assessed','failed')),
  status_error text,
  occurred_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON lesson_sessions(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_lesson  ON lesson_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status  ON lesson_sessions(status);

CREATE TABLE IF NOT EXISTS session_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  utterances jsonb NOT NULL,
  language varchar,
  summary text,
  raw_provider_response jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON session_transcripts(session_id);

CREATE TABLE IF NOT EXISTS session_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id),
  overall_engagement_score numeric CHECK (overall_engagement_score BETWEEN 0 AND 10),
  objective_scores jsonb,
  strengths jsonb,
  struggles jsonb,
  emotional_arc jsonb,
  lesson_coverage jsonb,
  recommendations text,
  raw_response jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessments_session ON session_assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_assessments_lesson  ON session_assessments(lesson_id);

CREATE TABLE IF NOT EXISTS parent_feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES tutors(id),
  student_id uuid REFERENCES students(id),
  mode varchar NOT NULL CHECK (mode IN ('per_session','weekly_digest')),
  session_ids uuid[] NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  content jsonb NOT NULL,
  status varchar DEFAULT 'draft'
    CHECK (status IN ('draft','tutor_edited','shared')),
  tutor_edits jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_student ON parent_feedback_reports(student_id, created_at DESC);

-- Staged memory proposals (lower-confidence findings awaiting tutor approval)
CREATE TABLE IF NOT EXISTS memory_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_session_id uuid REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  entity_type varchar NOT NULL,
  entity_id uuid NOT NULL,
  memory_category varchar NOT NULL,
  memory_key varchar NOT NULL,
  memory_value jsonb NOT NULL,
  confidence_score numeric CHECK (confidence_score BETWEEN 0 AND 1),
  status varchar DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES tutors(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memory_proposals_entity ON memory_proposals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_proposals_status ON memory_proposals(status);

-- Extend allowed agent_type values (existing CHECK currently blocks new ones)
ALTER TABLE agent_performance_metrics
  DROP CONSTRAINT IF EXISTS agent_performance_metrics_agent_type_check;
ALTER TABLE agent_performance_metrics
  ADD CONSTRAINT agent_performance_metrics_agent_type_check
  CHECK (agent_type IN ('strategy_planner','lesson_creator','activity_creator',
                        'session_assessor','feedback_generator'));

DO $$
BEGIN
  RAISE NOTICE '✅ Feedback agents migration applied';
  RAISE NOTICE '📋 Tables: lesson_sessions, session_transcripts, session_assessments, parent_feedback_reports, memory_proposals';
  RAISE NOTICE '⚠️  Reminder: create private Supabase Storage bucket named "session-media"';
END $$;
