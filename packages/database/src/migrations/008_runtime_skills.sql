-- ============================================================
-- Evva — Runtime skills (user-created declarative skills)
-- ============================================================

CREATE TABLE IF NOT EXISTS runtime_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'utility',
  config JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_runtime_skills_user ON runtime_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_runtime_skills_active ON runtime_skills(user_id) WHERE is_active = true;
