-- ============================================================
-- Evva — Improve RAG ranking with recency factor
-- ============================================================

-- Replace search function with recency-aware ranking
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
    -- 60% similarity + 20% importance + 20% recency
    (1 - (mf.embedding <=> p_embedding)) * 0.6
    + mf.importance * 0.2
    + LEAST(1.0, EXTRACT(EPOCH FROM (NOW() - COALESCE(mf.last_accessed_at, mf.created_at))) / 86400.0 / 30.0) * -0.2 + 0.2
    DESC
  LIMIT p_limit;
$$;
