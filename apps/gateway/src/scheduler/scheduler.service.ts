import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, type ScheduledJobPayload, type FactExtractionPayload } from '@evva/core';
import { generateId } from '@evva/core';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private connection!: IORedis;
  private scheduledJobsQueue!: Queue<ScheduledJobPayload>;
  private factExtractionQueue!: Queue<FactExtractionPayload>;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.logger.log(`Conectando a Redis: ${redisUrl.replace(/:[^:@]+@/, ':***@')}`);

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Requerido por BullMQ
    });

    this.scheduledJobsQueue = new Queue<ScheduledJobPayload>(
      QUEUE_NAMES.SCHEDULED_JOBS,
      { connection: this.connection },
    );

    this.factExtractionQueue = new Queue<FactExtractionPayload>(
      QUEUE_NAMES.FACT_EXTRACTION,
      { connection: this.connection },
    );

    this.logger.log('Scheduler conectado a Redis');
  }

  async onModuleDestroy() {
    await this.scheduledJobsQueue.close();
    await this.factExtractionQueue.close();
    this.connection.disconnect();
  }

  // ============================================================
  // Programar un recordatorio
  // ============================================================

  async scheduleReminder(params: {
    userId: string;
    telegramId: number;
    message: string;
    assistantName: string;
    triggerAt: Date;
    additionalContext?: string;
  }): Promise<string> {
    const jobId = generateId();
    const delay = params.triggerAt.getTime() - Date.now();

    if (delay < 0) {
      throw new Error('No se puede programar un recordatorio en el pasado');
    }

    const payload: ScheduledJobPayload = {
      jobId,
      userId: params.userId,
      telegramId: params.telegramId,
      type: 'reminder',
      context: {
        message: params.message,
        assistantName: params.assistantName,
        additionalContext: params.additionalContext,
      },
    };

    await this.scheduledJobsQueue.add('reminder', payload, {
      jobId,
      delay,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 60 * 60 * 24 }, // Mantener 24h después de completar
      removeOnFail: { age: 60 * 60 * 24 * 7 }, // Mantener 7 días si falla
    });

    this.logger.log(
      `Reminder scheduled: ${jobId} for user ${params.userId} at ${params.triggerAt.toISOString()}`,
    );

    return jobId;
  }

  // ============================================================
  // Encolar extracción de facts (asíncrona, no bloquea respuesta)
  // ============================================================

  async enqueueFactExtraction(params: {
    userId: string;
    sessionId: string;
    messages: FactExtractionPayload['messages'];
  }): Promise<void> {
    const payload: FactExtractionPayload = {
      userId: params.userId,
      sessionId: params.sessionId,
      messages: params.messages,
    };

    await this.factExtractionQueue.add('extract-facts', payload, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: { age: 60 * 60 * 24 },
    });

    this.logger.debug(
      `Fact extraction enqueued for session ${params.sessionId}`,
    );
  }

  // ============================================================
  // Cancelar un job pendiente
  // ============================================================

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.scheduledJobsQueue.getJob(jobId);
    if (!job) return false;

    await job.remove();
    this.logger.log(`Job cancelled: ${jobId}`);
    return true;
  }
}
