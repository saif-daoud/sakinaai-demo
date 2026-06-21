CREATE TABLE IF NOT EXISTS experts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expert_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
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
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  error TEXT,
  user_agent TEXT,
  page_url TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_generations_expert ON generations(expert_uid);
CREATE INDEX IF NOT EXISTS idx_generations_model ON generations(model_key);
CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);
