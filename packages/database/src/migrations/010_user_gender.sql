-- ============================================================
-- Evva — Add gender to users for language adaptation
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'neutral'
  CHECK (gender IN ('male', 'female', 'neutral'));
