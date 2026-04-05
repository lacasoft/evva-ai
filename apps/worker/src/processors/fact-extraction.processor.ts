import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, type FactExtractionPayload, type MemoryCategory } from '@evva/core';
import { saveMemoryFact } from '@evva/database';
import { generateResponse, embedText, buildFactExtractionPrompt } from '@evva/ai';

interface ExtractedFact {
  content: string;
  category: MemoryCategory;
  importance: number;
}

@Injectable()
export class FactExtractionProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FactExtractionProcessor.name);
  private connection!: IORedis;
  private worker!: Worker<FactExtractionPayload>;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<FactExtractionPayload>(
      QUEUE_NAMES.FACT_EXTRACTION,
      (job) => this.process(job),
      {
        connection: this.connection,
        concurrency: 3,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Fact extraction failed: ${job?.id} — ${err.message}`);
    });

    this.logger.log('FactExtractionProcessor iniciado');
  }

  async onModuleDestroy() {
    await this.worker.close();
    this.connection.disconnect();
  }

  // ============================================================
  // Procesa una conversación y extrae facts permanentes
  // ============================================================

  private async process(job: Job<FactExtractionPayload>): Promise<void> {
    const { userId, sessionId, messages } = job.data;

    // Solo procesar conversaciones con al menos un mensaje del usuario
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return;

    this.logger.debug(
      `Extracting facts from session ${sessionId} for user ${userId}`,
    );

    try {
      // Pedir al LLM que extraiga facts de la conversación
      const extractionPrompt = buildFactExtractionPrompt(messages);

      const response = await generateResponse({
        systemPrompt:
          'Eres un extractor de información. Responde SOLO con JSON válido, sin explicaciones.',
        messages: [{ role: 'user', content: extractionPrompt }],
        maxTokens: 512,
        temperature: 0.1, // Baja temperatura para extracciones más consistentes
      });

      // Parsear la respuesta JSON
      const facts = this.parseFacts(response.text);

      if (facts.length === 0) {
        this.logger.debug(
          `No facts extracted from session ${sessionId}`,
        );
        return;
      }

      this.logger.log(
        `Extracted ${facts.length} facts from session ${sessionId}`,
      );

      // Guardar cada fact con su embedding
      await Promise.allSettled(
        facts.map(async (fact) => {
          try {
            const { embedding } = await embedText(fact.content);
            await saveMemoryFact({
              userId,
              content: fact.content,
              category: fact.category,
              embedding,
              importance: fact.importance,
              sourceMessageId: sessionId,
            });
          } catch (err) {
            this.logger.error(
              `Failed to save fact "${fact.content}": ${err}`,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error(
        `Fact extraction error for session ${sessionId}: ${error}`,
      );
      // No re-lanzar — la extracción de facts es best-effort
    }
  }

  // ============================================================
  // Parsea la respuesta JSON del LLM de forma segura
  // ============================================================

  private parseFacts(rawText: string): ExtractedFact[] {
    try {
      // Limpiar posibles markdown code blocks
      const cleaned = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as { facts?: unknown[] };

      if (!parsed.facts || !Array.isArray(parsed.facts)) {
        return [];
      }

      const VALID_CATEGORIES: MemoryCategory[] = [
        'personal', 'relationship', 'work',
        'preference', 'goal', 'reminder', 'other',
      ];

      return parsed.facts
        .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
        .filter((f) => typeof f.content === 'string' && f.content.trim().length > 0)
        .map((f) => ({
          content: String(f.content).trim().slice(0, 500), // Max 500 chars
          category: VALID_CATEGORIES.includes(f.category as MemoryCategory)
            ? (f.category as MemoryCategory)
            : 'other',
          importance: typeof f.importance === 'number'
            ? Math.min(1, Math.max(0.1, f.importance))
            : 0.5,
        }));
    } catch {
      this.logger.debug('Failed to parse fact extraction response');
      return [];
    }
  }
}
