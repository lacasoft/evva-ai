import type { Habit, HabitLog } from "@evva/core";
import { generateId } from "@evva/core";
import { query, queryOne } from "../client.js";

// ============================================================
// Habits
// ============================================================

export async function createHabit(params: {
  userId: string;
  name: string;
  targetPerDay: number;
  unit?: string;
  reminderTimes?: string[];
}): Promise<Habit> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO habits (id, user_id, name, target_per_day, unit, reminder_times)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      id,
      params.userId,
      params.name,
      params.targetPerDay,
      params.unit ?? null,
      params.reminderTimes ? JSON.stringify(params.reminderTimes) : null,
    ],
  );

  if (!row) throw new Error("Failed to create habit");
  return mapToHabit(row);
}

export async function getUserHabits(userId: string): Promise<Habit[]> {
  const rows = await query(
    "SELECT * FROM habits WHERE user_id = $1 AND is_active = true ORDER BY name",
    [userId],
  );
  return rows.map(mapToHabit);
}

export async function deleteHabit(id: string, userId: string): Promise<void> {
  await query(
    "UPDATE habits SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
}

// ============================================================
// Habit Logs
// ============================================================

export async function logHabit(
  habitId: string,
  userId: string,
  date?: string,
  count?: number,
): Promise<HabitLog> {
  const logDate = date ?? new Date().toISOString().slice(0, 10);
  const increment = count ?? 1;

  const row = await queryOne(
    `INSERT INTO habit_logs (id, habit_id, user_id, date, count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (habit_id, date)
     DO UPDATE SET count = habit_logs.count + $5
     RETURNING *`,
    [generateId(), habitId, userId, logDate, increment],
  );

  if (!row) throw new Error("Failed to log habit");
  return mapToHabitLog(row);
}

export async function getHabitLogs(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<HabitLog[]> {
  const rows = await query(
    `SELECT * FROM habit_logs
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date DESC`,
    [userId, fromDate, toDate],
  );
  return rows.map(mapToHabitLog);
}

export async function getTodayProgress(userId: string): Promise<
  Array<{
    habit: Habit;
    logged: number;
    target: number;
  }>
> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await query(
    `SELECT h.*, COALESCE(hl.count, 0) AS logged_count
     FROM habits h
     LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = $2
     WHERE h.user_id = $1 AND h.is_active = true
     ORDER BY h.name`,
    [userId, today],
  );

  return rows.map((row) => ({
    habit: mapToHabit(row),
    logged: Number(row.logged_count),
    target: Number(row.target_per_day),
  }));
}

// ============================================================
// Mappers
// ============================================================

function mapToHabit(data: Record<string, unknown>): Habit {
  const reminderTimes =
    typeof data.reminder_times === "string"
      ? JSON.parse(data.reminder_times as string)
      : (data.reminder_times ?? undefined);

  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    targetPerDay: Number(data.target_per_day),
    unit: data.unit as string | undefined,
    reminderTimes: reminderTimes as string[] | undefined,
    isActive: data.is_active as boolean,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapToHabitLog(data: Record<string, unknown>): HabitLog {
  return {
    id: data.id as string,
    habitId: data.habit_id as string,
    userId: data.user_id as string,
    date: data.date as string,
    count: Number(data.count),
    createdAt: new Date(data.created_at as string),
  };
}
