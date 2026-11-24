-- Schema PostgreSQL (NeonDB) para o Cortex (MVP)

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  module_order INT NOT NULL,
  module_title TEXT NOT NULL,
  module_goal TEXT NOT NULL DEFAULT '',
  topic_order INT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_practice TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'learning', 'reviewing', 'mastered')),
  streak INT NOT NULL DEFAULT 0,
  interval_days INT NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NULL,
  practice_done BOOLEAN NOT NULL DEFAULT FALSE,
  last_score INT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS study_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_topics_order
  ON topics (module_order, topic_order);

CREATE INDEX IF NOT EXISTS idx_topics_next_review
  ON topics (next_review_at)
  WHERE next_review_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  item_id TEXT NULL,
  item_title TEXT NULL,
  user_explanation TEXT NOT NULL,
  ai_score INT NOT NULL CHECK (ai_score >= 0 AND ai_score <= 10),
  ai_feedback JSONB NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('hard', 'medium', 'easy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS item_id TEXT NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS item_title TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_topic_created
  ON attempts (topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attempts_topic_item_created
  ON attempts (topic_id, item_id, created_at DESC);
