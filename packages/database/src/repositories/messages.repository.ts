import type { Message, MessageRole } from '@evva/core';
import { LIMITS, generateId } from '@evva/core';
import { query, queryOne } from '../client.js';

export async function saveMessage(params: {
  userId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata?: Message['metadata'];
}): Promise<Message> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO messages (id, user_id, session_id, role, content, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      id,
      params.userId,
      params.sessionId,
      params.role,
      params.content,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ],
  );

  if (!row) {
    throw new Error('Failed to save message');
  }

  return mapToMessage(row);
}

export async function getRecentMessages(
  userId: string,
  limit = LIMITS.CONVERSATION_WINDOW,
): Promise<Message[]> {
  const rows = await query(
    `SELECT * FROM messages
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  // Regresamos en orden cronológico (más antiguos primero)
  return rows.map(mapToMessage).reverse();
}

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  const rows = await query(
    `SELECT * FROM messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId],
  );

  return rows.map(mapToMessage);
}

// ============================================================
// Mapper
// ============================================================

function mapToMessage(data: Record<string, unknown>): Message {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    sessionId: data.session_id as string,
    role: data.role as MessageRole,
    content: data.content as string,
    metadata: data.metadata as Message['metadata'],
    createdAt: new Date(data.created_at as string),
  };
}
