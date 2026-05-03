-- Migration: Tutor AI Tools (Tier 1–4)
-- Adds: tutor_saved_prompts, activity_sessions, activity_events,
--       activity_versions, student_insights
-- Alters: activities (parent_activity_id), curriculum_standards (new table)

-- 1. Saved prompt library (Tier 1.2)
create table if not exists tutor_saved_prompts (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  label text not null,
  prompt text not null,
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_prompts_tutor on tutor_saved_prompts(tutor_id, use_count desc);

-- 2. Activity sessions + events (Tier 2.2)
create table if not exists activity_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  tutor_id uuid references tutors(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  ai_summary text,
  ai_misconceptions jsonb,
  ai_strengths jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_activity on activity_sessions(activity_id, started_at desc);
create index if not exists idx_sessions_student on activity_sessions(student_id, started_at desc);

create table if not exists activity_events (
  id bigserial primary key,
  session_id uuid not null references activity_sessions(id) on delete cascade,
  ts timestamptz not null default now(),
  kind text not null,
  payload jsonb
);
create index if not exists idx_events_session_ts on activity_events(session_id, ts);

-- 3. Activity versions (Tier 3.4)
create table if not exists activity_versions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  version_number int not null,
  label text,
  code text not null,
  sandbox_url text,
  pinned_for_student_id uuid references students(id) on delete set null,
  created_by uuid references tutors(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(activity_id, version_number)
);
create index if not exists idx_versions_activity on activity_versions(activity_id, version_number desc);
create index if not exists idx_versions_pinned on activity_versions(pinned_for_student_id);

-- 4. Student insights (Tier 3.1)
create table if not exists student_insights (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  generated_at timestamptz not null default now(),
  kind text not null,
  topic text,
  evidence jsonb,
  recommended_action text,
  dismissed bool not null default false
);
create index if not exists idx_insights_student on student_insights(student_id, generated_at desc) where dismissed = false;

-- 5. Activities parent linkage (Tier 2.3 remix)
alter table activities add column if not exists parent_activity_id uuid references activities(id) on delete set null;
create index if not exists idx_activities_parent on activities(parent_activity_id);

-- 6. Curriculum standards (Tier 3.3 alignment) — minimal seed table
create table if not exists curriculum_standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  framework text not null,
  grade text,
  subject text,
  description text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_standards_grade_subject on curriculum_standards(grade, subject);

-- Seed a few common standards for quick demos
insert into curriculum_standards (code, framework, grade, subject, description) values
  ('CCSS.MATH.4.NF.A.1', 'CCSS', '4', 'math', 'Explain why fractions are equivalent using visual models'),
  ('CCSS.MATH.5.NF.B.3', 'CCSS', '5', 'math', 'Interpret a fraction as division of the numerator by the denominator'),
  ('CCSS.ELA.5.RL.1', 'CCSS', '5', 'reading', 'Quote accurately from a text when explaining inferences'),
  ('NGSS.MS.PS1-1', 'NGSS', '6-8', 'science', 'Develop models to describe atomic composition of simple molecules')
on conflict (code) do nothing;
