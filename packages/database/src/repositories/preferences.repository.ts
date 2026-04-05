import type { UserPreferences } from '@evva/core';
import { query, queryOne } from '../client.js';

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const row = await queryOne(
    'SELECT * FROM user_preferences WHERE user_id = $1',
    [userId],
  );

  if (!row) return null;
  return mapToPreferences(row);
}

export async function upsertPreferences(
  userId: string,
  updates: Partial<Pick<UserPreferences, 'dailyBriefingEnabled' | 'dailyBriefingHour' | 'dailyBriefingMinute'>>,
): Promise<UserPreferences> {
  const row = await queryOne(
    `INSERT INTO user_preferences (user_id, daily_briefing_enabled, daily_briefing_hour, daily_briefing_minute, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       daily_briefing_enabled = COALESCE($2, user_preferences.daily_briefing_enabled),
       daily_briefing_hour = COALESCE($3, user_preferences.daily_briefing_hour),
       daily_briefing_minute = COALESCE($4, user_preferences.daily_briefing_minute),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      updates.dailyBriefingEnabled ?? true,
      updates.dailyBriefingHour ?? 8,
      updates.dailyBriefingMinute ?? 0,
    ],
  );

  if (!row) throw new Error('Failed to upsert preferences');
  return mapToPreferences(row);
}

export async function getUsersWithBriefingAt(hour: number, minute: number): Promise<Array<{
  userId: string;
  telegramId: number;
  timezone: string;
  language: 'es' | 'en';
  telegramFirstName?: string;
  assistantName: string;
}>> {
  const rows = await query(
    `SELECT u.id as user_id, u.telegram_id, u.timezone, u.language, u.telegram_first_name,
            ac.name as assistant_name
     FROM user_preferences up
     JOIN users u ON u.id = up.user_id
     JOIN assistant_config ac ON ac.user_id = u.id
     WHERE up.daily_briefing_enabled = true
       AND up.daily_briefing_hour = $1
       AND up.daily_briefing_minute = $2
       AND u.is_active = true`,
    [hour, minute],
  );

  return rows.map(r => ({
    userId: r.user_id as string,
    telegramId: Number(r.telegram_id),
    timezone: r.timezone as string,
    language: r.language as 'es' | 'en',
    telegramFirstName: r.telegram_first_name as string | undefined,
    assistantName: r.assistant_name as string,
  }));
}

function mapToPreferences(data: Record<string, unknown>): UserPreferences {
  return {
    userId: data.user_id as string,
    dailyBriefingEnabled: data.daily_briefing_enabled as boolean,
    dailyBriefingHour: data.daily_briefing_hour as number,
    dailyBriefingMinute: data.daily_briefing_minute as number,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
