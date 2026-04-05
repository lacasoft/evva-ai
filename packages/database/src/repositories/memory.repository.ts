import type { MemoryCategory, MemoryFact } from "@evva/core";
import { LIMITS, generateId } from "@evva/core";
import { query, queryOne } from "../client.js";

export async function saveMemoryFact(params: {
  userId: string;
  content: string;
  category: MemoryCategory;
  embedding: number[];
  importance?: number;
  sourceMessageId?: string;
}): Promise<MemoryFact> {
  const id = generateId();

  // pgvector acepta el embedding como string '[0.1,0.2,...]'
  const embeddingStr = `[${params.embedding.join(",")}]`;

  const row = await queryOne(
    `INSERT INTO memory_facts (id, user_id, content, category, embedding, importance, source_message_id, last_accessed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::vector, $6, $7, NULL, NOW(), NOW())
     RETURNING *`,
    [
      id,
      params.userId,
      params.content,
      params.category,
      embeddingStr,
      params.importance ?? 0.5,
      params.sourceMessageId ?? null,
    ],
  );

  if (!row) {
    throw new Error("Failed to save memory fact");
  }

  return mapToMemoryFact(row);
}

export async function searchSimilarFacts(params: {
  userId: string;
  embedding: number[];
  limit?: number;
  threshold?: number;
}): Promise<MemoryFact[]> {
  const limit = params.limit ?? LIMITS.MEMORY_RETRIEVAL_TOP_K;
  const embeddingStr = `[${params.embedding.join(",")}]`;

  // Usa la función SQL search_memory_facts definida en la migración
  const rows = await query(
    `SELECT * FROM search_memory_facts($1, $2::vector, $3, $4)`,
    [params.userId, embeddingStr, limit, params.threshold ?? 0.7],
  );

  // Actualizar last_accessed_at de los facts recuperados
  const ids = rows.map((r) => r.id as string);
  if (ids.length > 0) {
    await query(
      `UPDATE memory_facts SET last_accessed_at = NOW() WHERE id = ANY($1)`,
      [ids],
    );
  }

  return rows.map(mapToMemoryFact);
}

export async function getAllUserFacts(userId: string): Promise<MemoryFact[]> {
  const rows = await query(
    `SELECT * FROM memory_facts
     WHERE user_id = $1
     ORDER BY importance DESC, created_at DESC`,
    [userId],
  );

  return rows.map(mapToMemoryFact);
}

export async function deleteMemoryFact(
  id: string,
  userId: string,
): Promise<void> {
  await query("DELETE FROM memory_facts WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
}

// ============================================================
// Mapper
// ============================================================

function mapToMemoryFact(data: Record<string, unknown>): MemoryFact {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    content: data.content as string,
    category: data.category as MemoryCategory,
    embedding: parseEmbedding(data.embedding),
    importance: data.importance as number,
    lastAccessedAt: data.last_accessed_at
      ? new Date(data.last_accessed_at as string)
      : undefined,
    sourceMessageId: data.source_message_id as string | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function parseEmbedding(value: unknown): number[] | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    // pgvector retorna '[0.1,0.2,...]'
    return value
      .replace(/[\[\]]/g, "")
      .split(",")
      .map(Number);
  }
  if (Array.isArray(value)) return value as number[];
  return undefined;
}
