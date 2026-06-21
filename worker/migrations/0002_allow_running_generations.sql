PRAGMA foreign_keys = off;

CREATE TABLE IF NOT EXISTS generations_new (
  id TEXT PRIMARY KEY,
  expert_uid TEXT NOT NULL,
  expert_email TEXT NOT NULL,
  model_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_name TEXT,
  input_language TEXT,
  transcript_text TEXT NOT NULL,
  translated_transcript TEXT,
  translated_with_fanar INTEGER NOT NULL DEFAULT 0,
  output_json TEXT,
  raw_output TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error TEXT,
  user_agent TEXT,
  page_url TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

INSERT OR IGNORE INTO generations_new (
  id, expert_uid, expert_email, model_key, provider, model_name, input_name,
  input_language, transcript_text, translated_transcript, translated_with_fanar,
  output_json, raw_output, status, error, user_agent, page_url, created_at, completed_at
)
SELECT
  id, expert_uid, expert_email, model_key, provider, model_name, input_name,
  input_language, transcript_text, translated_transcript, translated_with_fanar,
  output_json, raw_output, status, error, user_agent, page_url, created_at, completed_at
FROM generations;

DROP TABLE generations;
ALTER TABLE generations_new RENAME TO generations;

CREATE INDEX IF NOT EXISTS idx_generations_expert ON generations(expert_uid);
CREATE INDEX IF NOT EXISTS idx_generations_model ON generations(model_key);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);

PRAGMA foreign_keys = on;
