import { z } from "zod";

const envSchema = z.object({
  // Servidor
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),

  // Timezone y lenguaje por defecto
  DEFAULT_TIMEZONE: z.string().default("America/Mexico_City"),
  DEFAULT_LANGUAGE: z.enum(["es", "en"]).default("es"),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN es requerido"),
  TELEGRAM_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  TELEGRAM_SECRET_TOKEN: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY es requerido"),

  // Voyage AI
  VOYAGE_API_KEY: z.string().min(1, "VOYAGE_API_KEY es requerido"),

  // PostgreSQL
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL es requerido (e.g. postgresql://user:pass@localhost:5432/evva)",
    ),

  // Redis (para BullMQ)
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // OpenAI — TTS voice responses (https://platform.openai.com)
  OPENAI_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  // Groq — transcripción de voz con Whisper (https://console.groq.com)
  GROQ_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  // Google OAuth (https://console.cloud.google.com)
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  GOOGLE_REDIRECT_URI: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  // Brave Search (opcional en fase 1)
  BRAVE_SEARCH_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),

  // WhatsApp Cloud API (opcional — habilita el adapter de WhatsApp)
  WHATSAPP_ACCESS_TOKEN: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  WHATSAPP_PHONE_NUMBER_ID: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  WHATSAPP_VERIFY_TOKEN: z
    .string()
    .optional()
    .transform((v) => v || undefined),
});

export type AppConfig = z.infer<typeof envSchema>;

export const appConfig = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Variables de entorno inválidas:");
    result.error.errors.forEach((err) => {
      console.error(`  ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }

  return result.data;
};
