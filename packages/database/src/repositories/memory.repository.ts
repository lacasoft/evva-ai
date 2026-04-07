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
  const embeddingStr = `[${params.embedding.join(",")}]`;

  // Dedup: check if a very similar fact already exists
  const duplicates = await query(
    `SELECT id, content, importance FROM memory_facts
     WHERE user_id = $1
       AND embedding IS NOT NULL
       AND 1 - (embedding <=> $2::vector) > $3
     LIMIT 1`,
    [params.userId, embeddingStr, LIMITS.MEMORY_DEDUP_THRESHOLD],
  );

  if (duplicates.length > 0) {
    const existing = duplicates[0];
    // Update if new importance is higher, otherwise skip
    const newImportance = params.importance ?? 0.5;
    if (newImportance > (existing.importance as number)) {
      await query(
        `UPDATE memory_facts SET content = $1, importance = $2, category = $3, updated_at = NOW()
         WHERE id = $4`,
        [params.content, newImportance, params.category, existing.id],
      );
    }
    // Return the existing fact (updated or not)
    const updated = await queryOne("SELECT * FROM memory_facts WHERE id = $1", [
      existing.id,
    ]);
    return mapToMemoryFact(updated!);
  }

  // No duplicate — insert new
  const id = generateId();
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
  category?: string;
}): Promise<MemoryFact[]> {
  const limit = params.limit ?? LIMITS.MEMORY_RETRIEVAL_TOP_K;
  const threshold = params.threshold ?? LIMITS.MEMORY_SEARCH_THRESHOLD;
  const embeddingStr = `[${params.embedding.join(",")}]`;

  // Use direct query with optional category filter instead of SQL function
  const conditions = [
    "user_id = $1",
    "embedding IS NOT NULL",
    `1 - (embedding <=> $2::vector) >= $3`,
  ];
  const values: unknown[] = [params.userId, embeddingStr, threshold];

  if (params.category) {
    conditions.push(`category = $${values.length + 1}`);
    values.push(params.category);
  }

  const rows = await query(
    `SELECT *, 1 - (embedding <=> $2::vector) AS similarity
     FROM memory_facts
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       (1 - (embedding <=> $2::vector)) * 0.6
       + importance * 0.2
       + LEAST(1.0, EXTRACT(EPOCH FROM (NOW() - COALESCE(last_accessed_at, created_at))) / 86400.0 / 30.0) * -0.2 + 0.2
       DESC
     LIMIT $${values.length + 1}`,
    [...values, limit],
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
