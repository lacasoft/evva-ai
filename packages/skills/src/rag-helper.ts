import { saveMemoryFact } from "@evva/database";
import { embedText } from "@evva/ai";
import type { MemoryCategory } from "@evva/core";

/**
 * Saves a memory fact for RAG whenever a skill stores structured data.
 * This ensures the semantic search finds data across all skills.
 *
 * Call this AFTER saving to the specific table (contacts, credit_cards, etc.)
 * so the RAG can find it when the user asks about it.
 *
 * Failures are non-blocking — if embedding or save fails, the structured
 * data is still in its table.
 */
export async function saveFactForRAG(params: {
  userId: string;
  content: string;
  category: MemoryCategory;
  importance?: number;
}): Promise<void> {
  try {
    const { embedding } = await embedText(params.content);
    await saveMemoryFact({
      userId: params.userId,
      content: params.content,
      category: params.category,
      embedding,
      importance: params.importance ?? 0.6,
    });
  } catch {
    // Non-blocking — structured data is already saved in its specific table
    console.error(
      `[RAG] Failed to save fact for user ${params.userId}: ${params.content.slice(0, 50)}...`,
    );
  }
}
