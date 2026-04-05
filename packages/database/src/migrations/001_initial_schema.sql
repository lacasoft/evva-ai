-- ============================================================
-- Evva — Schema de PostgreSQL
-- Ejecutar: pnpm db:migrate
-- ============================================================

-- Habilitar extensión pgvector para búsqueda semántica
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  language TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- ============================================================
-- ASSISTANT CONFIG (1:1 con users)
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personality_base TEXT NOT NULL DEFAULT '',
  learned_preferences TEXT NOT NULL DEFAULT '',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_assistant_config_user_id ON assistant_config(user_id);

-- ============================================================
-- ONBOARDING STATE
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'welcome',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (historial de conversación)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Limpiar mensajes viejos automáticamente (más de 90 días)
-- Descomenta si quieres auto-cleanup:
-- CREATE INDEX IF NOT EXISTS idx_messages_cleanup ON messages(created_at)
--   WHERE created_at < NOW() - INTERVAL '90 days';

-- ============================================================
-- MEMORY FACTS (memoria semántica permanente)
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('personal','relationship','work','preference','goal','reminder','other')),
  embedding VECTOR(512),  -- voyage-3-lite produce 512 dimensiones
  importance FLOAT NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  last_accessed_at TIMESTAMPTZ,
  source_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_user_id ON memory_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_facts_category ON memory_facts(user_id, category);

-- Índice HNSW para búsqueda vectorial eficiente
CREATE INDEX IF NOT EXISTS idx_memory_facts_embedding
  ON memory_facts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- FUNCIÓN: búsqueda semántica de facts por usuario
-- ============================================================
CREATE OR REPLACE FUNCTION search_memory_facts(
  p_user_id UUID,
  p_embedding VECTOR(512),
  p_limit INT DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.65
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  category TEXT,
  embedding VECTOR(512),
  importance FLOAT,
  last_accessed_at TIMESTAMPTZ,
  source_message_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    mf.id,
    mf.user_id,
    mf.content,
    mf.category,
    mf.embedding,
    mf.importance,
    mf.last_accessed_at,
    mf.source_message_id,
    mf.created_at,
    mf.updated_at,
    1 - (mf.embedding <=> p_embedding) AS similarity
  FROM memory_facts mf
  WHERE
    mf.user_id = p_user_id
    AND mf.embedding IS NOT NULL
    AND 1 - (mf.embedding <=> p_embedding) >= p_threshold
  ORDER BY
    -- Combina similaridad e importancia para mejor ranking
    (1 - (mf.embedding <=> p_embedding)) * 0.7 + mf.importance * 0.3 DESC
  LIMIT p_limit;
$$;

-- ============================================================
-- MIGRATION TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
