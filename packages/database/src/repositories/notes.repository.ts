import type { Note, NoteItem } from '@evva/core';
import { generateId } from '@evva/core';
import { query, queryOne } from '../client.js';

export async function createNote(params: {
  userId: string;
  title: string;
  content?: string;
  isList?: boolean;
  items?: NoteItem[];
}): Promise<Note> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO notes (id, user_id, title, content, is_list, items, is_pinned, is_archived, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, false, NOW(), NOW())
     RETURNING *`,
    [
      id,
      params.userId,
      params.title,
      params.content ?? '',
      params.isList ?? false,
      JSON.stringify(params.items ?? []),
    ],
  );

  if (!row) throw new Error('Failed to create note');
  return mapToNote(row);
}

export async function getUserNotes(userId: string, includeArchived = false): Promise<Note[]> {
  const sql = includeArchived
    ? 'SELECT * FROM notes WHERE user_id = $1 ORDER BY is_pinned DESC, updated_at DESC'
    : 'SELECT * FROM notes WHERE user_id = $1 AND is_archived = false ORDER BY is_pinned DESC, updated_at DESC';

  const rows = await query(sql, [userId]);
  return rows.map(mapToNote);
}

export async function getNoteById(id: string, userId: string): Promise<Note | null> {
  const row = await queryOne(
    'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
    [id, userId],
  );

  if (!row) return null;
  return mapToNote(row);
}

export async function findNoteByTitle(userId: string, title: string): Promise<Note | null> {
  const row = await queryOne(
    'SELECT * FROM notes WHERE user_id = $1 AND LOWER(title) = LOWER($2) AND is_archived = false',
    [userId, title],
  );

  if (!row) return null;
  return mapToNote(row);
}

export async function updateNote(
  id: string,
  userId: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'items' | 'isPinned' | 'isArchived'>>,
): Promise<void> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    setClauses.push(`content = $${paramIndex++}`);
    values.push(updates.content);
  }
  if (updates.items !== undefined) {
    setClauses.push(`items = $${paramIndex++}`);
    values.push(JSON.stringify(updates.items));
  }
  if (updates.isPinned !== undefined) {
    setClauses.push(`is_pinned = $${paramIndex++}`);
    values.push(updates.isPinned);
  }
  if (updates.isArchived !== undefined) {
    setClauses.push(`is_archived = $${paramIndex++}`);
    values.push(updates.isArchived);
  }

  values.push(id, userId);

  await query(
    `UPDATE notes SET ${setClauses.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
    values,
  );
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  await query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
}

function mapToNote(data: Record<string, unknown>): Note {
  const items = typeof data.items === 'string'
    ? JSON.parse(data.items as string)
    : (data.items ?? []);

  return {
    id: data.id as string,
    userId: data.user_id as string,
    title: data.title as string,
    content: data.content as string,
    isList: data.is_list as boolean,
    items: items as NoteItem[],
    isPinned: data.is_pinned as boolean,
    isArchived: data.is_archived as boolean,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
