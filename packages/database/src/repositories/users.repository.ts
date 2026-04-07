import type { Assistant, OnboardingState, User } from "@evva/core";
import { generateId, DEFAULT_TIMEZONE } from "@evva/core";
import { query, queryOne } from "../client.js";

// ============================================================
// Users
// ============================================================

export async function findUserByTelegramId(
  telegramId: number,
): Promise<User | null> {
  const row = await queryOne("SELECT * FROM users WHERE telegram_id = $1", [
    telegramId,
  ]);

  if (!row) return null;
  return mapToUser(row);
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await queryOne("SELECT * FROM users WHERE id = $1", [id]);

  if (!row) return null;
  return mapToUser(row);
}

export async function createUser(params: {
  telegramId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  language?: "es" | "en";
  timezone?: string;
}): Promise<User> {
  const id = generateId();
  const now = new Date().toISOString();

  const row = await queryOne(
    `INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, language, timezone, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
     RETURNING *`,
    [
      id,
      params.telegramId,
      params.telegramUsername ?? null,
      params.telegramFirstName ?? null,
      params.language ?? "es",
      params.timezone ?? DEFAULT_TIMEZONE,
      now,
    ],
  );

  if (!row) {
    throw new Error("Failed to create user");
  }

  return mapToUser(row);
}

export async function upsertUser(params: {
  telegramId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
}): Promise<User> {
  const existing = await findUserByTelegramId(params.telegramId);
  if (existing) return existing;
  return createUser(params);
}

// ============================================================
// Assistants
// ============================================================

export async function findAssistantByUserId(
  userId: string,
): Promise<Assistant | null> {
  const row = await queryOne(
    "SELECT * FROM assistant_config WHERE user_id = $1",
    [userId],
  );

  if (!row) return null;
  return mapToAssistant(row);
}

export async function createAssistant(params: {
  userId: string;
  name: string;
  personalityBase?: string;
}): Promise<Assistant> {
  const id = generateId();
  const now = new Date().toISOString();
  const defaultPersonality = buildDefaultPersonality(params.name);

  const row = await queryOne(
    `INSERT INTO assistant_config (id, user_id, name, personality_base, learned_preferences, onboarding_completed, created_at, updated_at)
     VALUES ($1, $2, $3, $4, '', false, $5, $5)
     RETURNING *`,
    [
      id,
      params.userId,
      params.name,
      params.personalityBase ?? defaultPersonality,
      now,
    ],
  );

  if (!row) {
    throw new Error("Failed to create assistant");
  }

  return mapToAssistant(row);
}

export async function updateAssistant(
  userId: string,
  updates: Partial<
    Pick<
      Assistant,
      "name" | "personalityBase" | "learnedPreferences" | "onboardingCompleted"
    >
  >,
): Promise<void> {
  const setClauses: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.personalityBase !== undefined) {
    setClauses.push(`personality_base = $${paramIndex++}`);
    values.push(updates.personalityBase);
  }
  if (updates.learnedPreferences !== undefined) {
    setClauses.push(`learned_preferences = $${paramIndex++}`);
    values.push(updates.learnedPreferences);
  }
  if (updates.onboardingCompleted !== undefined) {
    setClauses.push(`onboarding_completed = $${paramIndex++}`);
    values.push(updates.onboardingCompleted);
  }

  values.push(userId);

  await query(
    `UPDATE assistant_config SET ${setClauses.join(", ")} WHERE user_id = $${paramIndex}`,
    values,
  );
}

// ============================================================
// Onboarding State
// ============================================================

export async function getOnboardingState(
  userId: string,
): Promise<OnboardingState | null> {
  const row = await queryOne(
    "SELECT * FROM onboarding_state WHERE user_id = $1",
    [userId],
  );

  if (!row) return null;

  return {
    userId: row.user_id as string,
    currentStep: row.current_step as OnboardingState["currentStep"],
    data: (row.data as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function upsertOnboardingState(
  userId: string,
  step: OnboardingState["currentStep"],
  data: OnboardingState["data"],
): Promise<void> {
  await query(
    `INSERT INTO onboarding_state (user_id, current_step, data, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET current_step = $2, data = $3, updated_at = NOW()`,
    [userId, step, JSON.stringify(data)],
  );
}

// ============================================================
// Mappers
// ============================================================

function mapToUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    telegramId: Number(data.telegram_id),
    telegramUsername: data.telegram_username as string | undefined,
    telegramFirstName: data.telegram_first_name as string | undefined,
    language: data.language as "es" | "en",
    timezone: data.timezone as string,
    gender: (data.gender as "male" | "female" | "neutral") ?? "neutral",
    isActive: data.is_active as boolean,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapToAssistant(data: Record<string, unknown>): Assistant {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    personalityBase: data.personality_base as string,
    learnedPreferences: data.learned_preferences as string,
    onboardingCompleted: data.onboarding_completed as boolean,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function buildDefaultPersonality(name: string): string {
  return `Eres ${name}, un asistente personal inteligente, cálido y de confianza.
Hablas de manera natural y cercana, como un amigo de confianza, no como un robot.
Eres proactivo: si recuerdas algo importante del usuario, lo mencionas cuando es relevante.
Respondes en el mismo idioma que el usuario te escriba.
Eres conciso: das respuestas directas y útiles, sin rodeos innecesarios.
Cuando no sabes algo, lo dices honestamente.`;
}
