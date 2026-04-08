import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { query } from "@evva/database";
import {
  QUEUE_NAMES,
  type ScheduledJobPayload,
  type FactExtractionPayload,
} from "@evva/core";
import { generateId } from "@evva/core";

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private connection!: IORedis;
  private scheduledJobsQueue!: Queue<ScheduledJobPayload>;
  private factExtractionQueue!: Queue<FactExtractionPayload>;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.logger.log(
      `Conectando a Redis: ${redisUrl.replace(/:[^:@]+@/, ":***@")}`,
    );

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

    this.logger.log("Scheduler conectado a Redis");
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
      throw new Error("No se puede programar un recordatorio en el pasado");
    }

    // Dedup: skip if same user + similar message + same time already pending
    const existing = await query(
      `SELECT id FROM scheduled_reminders
       WHERE user_id = $1 AND status = 'pending'
         AND trigger_at = $2
         AND message ILIKE $3
       LIMIT 1`,
      [params.userId, params.triggerAt.toISOString(), `%${params.message.slice(0, 30)}%`],
    );

    if (existing.length > 0) {
      this.logger.log(`Duplicate reminder skipped for user ${params.userId}: "${params.message.slice(0, 40)}"`);
      return existing[0].id as string;
    }

    // Persist to DB (survives Redis restarts, no delay limits)
    await query(
      `INSERT INTO scheduled_reminders (id, user_id, telegram_id, message, assistant_name, additional_context, trigger_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        jobId,
        params.userId,
        params.telegramId,
        params.message,
        params.assistantName,
        params.additionalContext ?? null,
        params.triggerAt.toISOString(),
      ],
    );

    // For short delays (<24h), also use BullMQ for immediate delivery
    const MAX_BULLMQ_DELAY = 24 * 60 * 60 * 1000; // 24 hours
    if (delay <= MAX_BULLMQ_DELAY) {
      const payload: ScheduledJobPayload = {
        jobId,
        userId: params.userId,
        telegramId: params.telegramId,
        type: "reminder",
        context: {
          message: params.message,
          assistantName: params.assistantName,
          additionalContext: params.additionalContext,
        },
      };

      await this.scheduledJobsQueue.add("reminder", payload, {
        jobId,
        delay,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      });
    }

    this.logger.log(
      `Reminder scheduled: ${jobId} for user ${params.userId} at ${params.triggerAt.toISOString()} (delay: ${Math.round(delay / 60000)}min, bullmq: ${delay <= MAX_BULLMQ_DELAY})`,
    );

    return jobId;
  }

  // ============================================================
  // Encolar extracción de facts (asíncrona, no bloquea respuesta)
  // ============================================================

  async enqueueFactExtraction(params: {
    userId: string;
    sessionId: string;
    messages: FactExtractionPayload["messages"];
  }): Promise<void> {
    const payload: FactExtractionPayload = {
      userId: params.userId,
      sessionId: params.sessionId,
      messages: params.messages,
    };

    await this.factExtractionQueue.add("extract-facts", payload, {
      attempts: 2,
      backoff: { type: "fixed", delay: 3000 },
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
