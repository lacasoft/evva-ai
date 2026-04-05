import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, type ScheduledJobPayload } from "@evva/core";
import { findUserById } from "@evva/database";
import { generateResponse } from "@evva/ai";
import { buildProactiveMessagePrompt } from "@evva/ai";
import { TelegramSenderService } from "../handlers/telegram-sender.service.js";

@Injectable()
export class ScheduledJobProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledJobProcessor.name);
  private connection!: IORedis;
  private worker!: Worker<ScheduledJobPayload>;

  constructor(private readonly telegramSender: TelegramSenderService) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<ScheduledJobPayload>(
      QUEUE_NAMES.SCHEDULED_JOBS,
      (job) => this.process(job),
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.log(`Job completed: ${job.id}`);
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job failed: ${job?.id} — ${err.message}`);
    });

    this.logger.log("ScheduledJobProcessor iniciado");
  }

  async onModuleDestroy() {
    await this.worker.close();
    this.connection.disconnect();
  }

  // ============================================================
  // Procesador principal — ejecuta cada job de la queue
  // ============================================================

  private async process(job: Job<ScheduledJobPayload>): Promise<void> {
    const { userId, telegramId, context, type } = job.data;

    this.logger.log(`Processing ${type} job ${job.id} for user ${userId}`);

    try {
      // Cargar datos del usuario para personalizar el mensaje
      const user = await findUserById(userId);
      if (!user) {
        this.logger.warn(`User ${userId} not found — skipping job ${job.id}`);
        return;
      }

      // Construir el prompt proactivo
      const prompt = buildProactiveMessagePrompt({
        assistantName: context.assistantName,
        userFirstName: user.telegramFirstName,
        reminderMessage: context.message,
        additionalContext: context.additionalContext,
        timezone: user.timezone,
        language: user.language,
      });

      // Generar el mensaje con el LLM
      const response = await generateResponse({
        systemPrompt: prompt,
        messages: [
          {
            role: "user",
            content: `Genera el mensaje de recordatorio ahora.`,
          },
        ],
        maxTokens: 256,
        temperature: 0.8,
      });

      const message = response.text?.trim();
      if (!message) {
        throw new Error("LLM returned empty message for proactive job");
      }

      // Enviar por Telegram
      await this.telegramSender.send(telegramId, message);

      this.logger.log(
        `Proactive message sent to ${telegramId} — job ${job.id}`,
      );
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error}`);
      throw error; // BullMQ lo reintentará según la config
    }
  }
}
