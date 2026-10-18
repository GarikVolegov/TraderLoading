CREATE TABLE IF NOT EXISTS academy_lessons (
  id text PRIMARY KEY,
  module_id text NOT NULL CHECK (module_id IN ('preparazione','contesto','sinistra','esecuzione','target','scalp','swing','revisione')),
  syllabus_id text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  video_url text,
  body_markdown text NOT NULL DEFAULT '',
  exercise_prompt text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_published_video CHECK (NOT published OR (video_url IS NOT NULL AND length(trim(video_url)) > 0))
);
CREATE INDEX IF NOT EXISTS academy_lessons_catalog_idx ON academy_lessons(published,module_id,order_index);
CREATE TABLE IF NOT EXISTS academy_progress (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz,
  exercise_response text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  feedback text NOT NULL DEFAULT '',
  reviewed_by text,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_progress_owner_lesson_idx ON academy_progress(user_id,lesson_id);
CREATE INDEX IF NOT EXISTS academy_progress_submitted_idx ON academy_progress(submitted_at);
