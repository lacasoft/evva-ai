import { Injectable, Logger } from '@nestjs/common';
import type { MemoryCategory, MemoryFact } from '@evva/core';
import { saveMemoryFact, searchSimilarFacts, getAllUserFacts } from '@evva/database';
import { embedText, embedQuery } from '@evva/ai';

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
    this.logger.debug(`Saving fact for user ${params.userId}: "${params.content}"`);

    const { embedding } = await embedText(params.content);

    return saveMemoryFact({
      ...params,
      embedding,
    });
  }

  // ============================================================
  // Buscar facts relevantes para una query
  // ============================================================

  async searchRelevantFacts(params: {
    userId: string;
    query: string;
    limit?: number;
  }): Promise<MemoryFact[]> {
    const { embedding } = await embedQuery(params.query);

    const facts = await searchSimilarFacts({
      userId: params.userId,
      embedding,
      limit: params.limit ?? 5,
      threshold: 0.65,
    });

    this.logger.debug(
      `Found ${facts.length} relevant facts for user ${params.userId}`,
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
