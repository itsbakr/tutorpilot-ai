-- ============================================================================
-- Migration: Tutor AI Toolkit (9 new agents + supporting infra)
--   Phase 0a: notifications
--   Phase 0b: tutor preferences (timezone, working_hours, language, comm)
--   Phase 1:  standards
--   Phase 2:  briefings
--   Phase 3:  voice memos
--   Phase 4:  homework
--   Phase 8:  integrity check column on submissions
--   ALTER:    agent_performance_metrics CHECK to include all 9 new agent types
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Phase 0a: in-app notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_tutor_id uuid REFERENCES tutors(id) ON DELETE CASCADE,
  category varchar NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb,
  priority varchar DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_tutor_id, read_at NULLS FIRST, created_at DESC);

-- ----------------------------------------------------------------------------
-- Phase 0b: tutor preferences
-- ----------------------------------------------------------------------------
ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS working_hours jsonb,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS comm_preferences jsonb
    DEFAULT '{"in_app":true,"weekly_digest":true,"ai_suggestions":true,
              "reminders":{"session_starting":true,"homework_pending":true,
                           "misconception_detected":true,"report_overdue":true,
                           "weekly_digest":false}}'::jsonb;

-- ----------------------------------------------------------------------------
-- Phase 1: curriculum standards (lazy-seeded per framework × subject × grade)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework varchar NOT NULL,
  subject varchar NOT NULL,
  grade_level varchar,
  code varchar NOT NULL,
  description text NOT NULL,
  parent_code varchar,
  source_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (framework, code)
);
CREATE INDEX IF NOT EXISTS idx_standards_framework_subject
  ON curriculum_standards(framework, subject, grade_level);

CREATE TABLE IF NOT EXISTS lesson_standards (
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  standard_id uuid REFERENCES curriculum_standards(id),
  alignment_strength numeric CHECK (alignment_strength BETWEEN 0 AND 1),
  rationale text,
  PRIMARY KEY (lesson_id, standard_id)
);
CREATE INDEX IF NOT EXISTS idx_lesson_standards_standard
  ON lesson_standards(standard_id);

-- ----------------------------------------------------------------------------
-- Phase 2: pre-session briefings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pre_session_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  tutor_id uuid REFERENCES tutors(id),
  upcoming_lesson_id uuid REFERENCES lessons(id),
  content jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_briefings_student
  ON pre_session_briefings(student_id, generated_at DESC);

-- ----------------------------------------------------------------------------
-- Phase 3: voice memos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES tutors(id),
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  media_url text NOT NULL,
  duration_seconds int,
  transcript text,
  status varchar DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed')),
  status_error text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voice_memos_tutor
  ON voice_memos(tutor_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Phase 4: homework
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES tutors(id),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id),
  title text NOT NULL,
  format varchar NOT NULL
    CHECK (format IN ('worksheet','problem_set','reading','reflection')),
  content jsonb NOT NULL,
  estimated_duration_minutes int,
  standards jsonb,
  status varchar DEFAULT 'assigned'
    CHECK (status IN ('assigned','submitted','graded')),
  due_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_homework_student
  ON homework_assignments(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES homework_assignments(id) ON DELETE CASCADE,
  submission_type varchar NOT NULL
    CHECK (submission_type IN ('photo','typed','mixed')),
  media_urls text[],
  typed_answers jsonb,
  ocr_text text,
  graded_results jsonb,
  overall_score numeric CHECK (overall_score BETWEEN 0 AND 100),
  feedback_markdown text,
  integrity_check jsonb,            -- Phase 8: { ai_likelihood, signals[], recommendation }
  graded_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment
  ON homework_submissions(assignment_id);

-- ----------------------------------------------------------------------------
-- Reflection: extend allowed agent_type values
-- ----------------------------------------------------------------------------
ALTER TABLE agent_performance_metrics
  DROP CONSTRAINT IF EXISTS agent_performance_metrics_agent_type_check;
ALTER TABLE agent_performance_metrics
  ADD CONSTRAINT agent_performance_metrics_agent_type_check
  CHECK (agent_type IN (
    'strategy_planner','lesson_creator','activity_creator',
    'session_assessor','feedback_generator',
    'standards_aligner','briefing_agent','voice_memo_agent',
    'homework_generator','homework_checker',
    'misconception_detector','difficulty_calibrator',
    'language_adapter','integrity_check'
  ));

DO $$
BEGIN
  RAISE NOTICE '✅ Tutor AI Toolkit migration applied';
  RAISE NOTICE '⚠️  Reminder: create private Supabase Storage bucket "homework-media" (audio bucket "session-media" already required)';
END $$;
