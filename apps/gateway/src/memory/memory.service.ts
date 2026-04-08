import { Injectable, Logger } from "@nestjs/common";
import type { MemoryCategory, MemoryFact } from "@evva/core";
import { LIMITS } from "@evva/core";
import {
  saveMemoryFact,
  searchSimilarFacts,
  getAllUserFacts,
  getProfileFacts,
} from "@evva/database";
import { embedText, embedQuery } from "@evva/ai";

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  // ============================================================
  // Guardar un fact nuevo
  // ============================================================

  async saveFact(params: {
    userId: string;
    content: string;
    category: MemoryCategory;
    importance?: number;
    sourceMessageId?: string;
  }): Promise<MemoryFact> {
    this.logger.debug(
      `Saving fact for user ${params.userId}: "${params.content}"`,
    );

    const { embedding } = await embedText(params.content);

    return saveMemoryFact({
      ...params,
      embedding,
    });
  }

  // ============================================================
  // Layer 1: Profile facts — always loaded, high importance
  // ============================================================

  async getProfileFacts(userId: string): Promise<MemoryFact[]> {
    return getProfileFacts(
      userId,
      LIMITS.MEMORY_PROFILE_TOP_K,
      LIMITS.MEMORY_PROFILE_IMPORTANCE,
    );
  }

  // ============================================================
  // Layer 2: Contextual facts — enriched semantic search
  // ============================================================

  async searchContextualFacts(params: {
    userId: string;
    query: string;
    profileContext?: string;
    limit?: number;
  }): Promise<MemoryFact[]> {
    // Enrich query with profile context for better semantic matching
    // "hola" → "hola, contexto: Carlos, esposa Maria, ingeniero"
    const enrichedQuery = params.profileContext
      ? `${params.query}. Contexto del usuario: ${params.profileContext}`
      : params.query;

    const { embedding } = await embedQuery(enrichedQuery);

    const facts = await searchSimilarFacts({
      userId: params.userId,
      embedding,
      limit: params.limit ?? LIMITS.MEMORY_RETRIEVAL_TOP_K,
      threshold: LIMITS.MEMORY_SEARCH_THRESHOLD,
    });

    this.logger.debug(
      `Found ${facts.length} contextual facts for user ${params.userId}`,
    );

    return facts;
  }

  // ============================================================
  // Obtener todos los facts (para contexto completo)
  // ============================================================

  async getAllFacts(userId: string): Promise<MemoryFact[]> {
    return getAllUserFacts(userId);
  }

  // ============================================================
  // Procesar extracción de facts desde una conversación
  // Llamado de forma asíncrona por el worker
  // ============================================================

  async extractAndSaveFacts(params: {
    userId: string;
    sessionId: string;
    rawFacts: Array<{
      content: string;
      category: MemoryCategory;
      importance: number;
    }>;
  }): Promise<void> {
    if (params.rawFacts.length === 0) return;

    this.logger.log(
      `Saving ${params.rawFacts.length} extracted facts for user ${params.userId}`,
    );

    await Promise.allSettled(
      params.rawFacts.map((fact) =>
        this.saveFact({
          userId: params.userId,
          content: fact.content,
          category: fact.category,
          importance: fact.importance,
          sourceMessageId: params.sessionId,
        }),
      ),
    );
  }
}
