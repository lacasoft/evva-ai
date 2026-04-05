-- ============================================================
-- Evva — Preferencias de usuario para resumen diario
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_briefing_enabled BOOLEAN NOT NULL DEFAULT false,
  daily_briefing_hour INTEGER NOT NULL DEFAULT 8 CHECK (daily_briefing_hour >= 0 AND daily_briefing_hour <= 23),
  daily_briefing_minute INTEGER NOT NULL DEFAULT 0 CHECK (daily_briefing_minute >= 0 AND daily_briefing_minute <= 59),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
