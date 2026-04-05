-- ============================================================
-- Evva — Palabra secreta para finanzas
-- ============================================================

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS finance_secret_hash TEXT,
  ADD COLUMN IF NOT EXISTS finance_secret_enabled BOOLEAN NOT NULL DEFAULT false;
