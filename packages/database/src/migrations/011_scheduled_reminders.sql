-- ============================================================
-- Evva — Persistent reminders table for long-term scheduling
-- BullMQ delays have limits; this table survives restarts
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  assistant_name TEXT NOT NULL,
  additional_context TEXT,
  trigger_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON scheduled_reminders(trigger_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reminders_user
  ON scheduled_reminders(user_id);
