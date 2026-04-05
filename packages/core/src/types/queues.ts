import type { JobContext, JobType } from "./entities.js";

// ============================================================
// BullMQ Queue Names
// ============================================================
export const QUEUE_NAMES = {
  SCHEDULED_JOBS: "scheduled-jobs",
  FACT_EXTRACTION: "fact-extraction",
  OUTBOUND_MESSAGES: "outbound-messages",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================================
// Job Payloads — lo que viaja en cada job de la queue
// ============================================================

export interface ScheduledJobPayload {
  jobId: string;
  userId: string;
  telegramId: number;
  type: JobType;
  context: JobContext;
}

export interface FactExtractionPayload {
  userId: string;
  sessionId: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface OutboundMessagePayload {
  telegramId: number;
  message: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  metadata?: Record<string, unknown>;
}
