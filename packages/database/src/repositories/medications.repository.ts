import type { Medication } from '@evva/core';
import { generateId } from '@evva/core';
import { query, queryOne } from '../client.js';

export async function createMedication(params: {
  userId: string;
  name: string;
  dosage?: string;
  frequency: string;
  times: string[];
  notes?: string;
}): Promise<Medication> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO medications (id, user_id, name, dosage, frequency, times, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      params.userId,
      params.name,
      params.dosage ?? null,
      params.frequency,
      JSON.stringify(params.times),
      params.notes ?? null,
    ],
  );

  if (!row) throw new Error('Failed to create medication');
  return mapToMedication(row);
}

export async function getUserMedications(userId: string): Promise<Medication[]> {
  const rows = await query(
    'SELECT * FROM medications WHERE user_id = $1 AND is_active = true ORDER BY name',
    [userId],
  );
  return rows.map(mapToMedication);
}

export async function updateMedication(
  id: string,
  userId: string,
  updates: Partial<Pick<Medication, 'name' | 'dosage' | 'frequency' | 'times' | 'notes' | 'isActive'>>,
): Promise<void> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.dosage !== undefined) {
    setClauses.push(`dosage = $${paramIndex++}`);
    values.push(updates.dosage);
  }
  if (updates.frequency !== undefined) {
    setClauses.push(`frequency = $${paramIndex++}`);
    values.push(updates.frequency);
  }
  if (updates.times !== undefined) {
    setClauses.push(`times = $${paramIndex++}`);
    values.push(JSON.stringify(updates.times));
  }
  if (updates.notes !== undefined) {
    setClauses.push(`notes = $${paramIndex++}`);
    values.push(updates.notes);
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);
  }

  values.push(id, userId);

  await query(
    `UPDATE medications SET ${setClauses.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
    values,
  );
}

export async function deleteMedication(id: string, userId: string): Promise<void> {
  await query(
    'UPDATE medications SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
}

function mapToMedication(data: Record<string, unknown>): Medication {
  const times = typeof data.times === 'string'
    ? JSON.parse(data.times as string)
    : (data.times ?? []);

  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    dosage: data.dosage as string | undefined,
    frequency: data.frequency as string,
    times: times as string[],
    notes: data.notes as string | undefined,
    isActive: data.is_active as boolean,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
