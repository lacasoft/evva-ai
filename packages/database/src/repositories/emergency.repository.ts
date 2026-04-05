import type { EmergencyContact } from '@evva/core';
import { generateId } from '@evva/core';
import { query, queryOne } from '../client.js';

export async function createEmergencyContact(params: {
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary?: boolean;
}): Promise<EmergencyContact> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO emergency_contacts (id, user_id, name, phone, relationship, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      id,
      params.userId,
      params.name,
      params.phone,
      params.relationship,
      params.isPrimary ?? false,
    ],
  );

  if (!row) throw new Error('Failed to create emergency contact');
  return mapToEmergencyContact(row);
}

export async function getUserEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const rows = await query(
    'SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY is_primary DESC, name',
    [userId],
  );
  return rows.map(mapToEmergencyContact);
}

export async function deleteEmergencyContact(id: string, userId: string): Promise<void> {
  await query(
    'DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
}

function mapToEmergencyContact(data: Record<string, unknown>): EmergencyContact {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    phone: data.phone as string,
    relationship: data.relationship as string,
    isPrimary: data.is_primary as boolean,
    createdAt: new Date(data.created_at as string),
  };
}
