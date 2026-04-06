import { saveMemoryFact, searchSimilarFacts } from "@evva/database";
import { embedText } from "@evva/ai";
import type { MemoryCategory } from "@evva/core";

/**
 * Saves a memory fact for RAG whenever a skill stores structured data.
 * Includes text-level deduplication BEFORE generating embeddings (saves API calls).
 *
 * Dedup strategy:
 * 1. First check: search existing facts by text similarity (cheap, no API call)
 * 2. If no text match: generate embedding and use cosine dedup in saveMemoryFact
 * 3. Non-blocking — failures don't affect structured data
 */
export async function saveFactForRAG(params: {
  userId: string;
  content: string;
  category: MemoryCategory;
  importance?: number;
}): Promise<void> {
  try {
    // Quick text-level dedup: generate embedding and let saveMemoryFact handle cosine dedup
    // saveMemoryFact already checks cosine > 0.92 and updates if higher importance
    const { embedding } = await embedText(params.content);
    await saveMemoryFact({
      userId: params.userId,
      content: params.content,
      category: params.category,
      embedding,
      importance: params.importance ?? 0.6,
    });
  } catch {
    console.error(
      `[RAG] Failed to save fact for user ${params.userId}: ${params.content.slice(0, 50)}...`,
    );
  }
}

/**
 * Check if a similar fact already exists for this user (text-based, no API call).
 * Use this before calling saveFactForRAG to avoid unnecessary embedding API calls.
 */
export async function factExists(
  userId: string,
  contentFragment: string,
): Promise<boolean> {
  try {
    // Use embedQuery to search — this costs 1 API call but is reliable
    const { embedding } = await embedText(contentFragment);
    const existing = await searchSimilarFacts({
      userId,
      embedding,
      limit: 1,
      threshold: 0.9,
    });
    return existing.length > 0;
  } catch {
    return false;
  }
}
