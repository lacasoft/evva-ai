import type { Contact } from "@evva/core";
import { generateId } from "@evva/core";
import { query, queryOne } from "../client.js";

export async function createContact(params: {
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
  notes?: string;
}): Promise<Contact> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO contacts (id, user_id, name, phone, email, relationship, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [
      id,
      params.userId,
      params.name,
      params.phone ?? null,
      params.email ?? null,
      params.relationship ?? null,
      params.notes ?? null,
    ],
  );

  if (!row) throw new Error("Failed to create contact");
  return mapToContact(row);
}

export async function searchContacts(
  userId: string,
  searchTerm: string,
): Promise<Contact[]> {
  const rows = await query(
    `SELECT * FROM contacts
     WHERE user_id = $1
       AND (LOWER(name) LIKE LOWER($2) OR LOWER(relationship) LIKE LOWER($2))
     ORDER BY name ASC`,
    [userId, `%${searchTerm}%`],
  );

  return rows.map(mapToContact);
}

export async function getUserContacts(userId: string): Promise<Contact[]> {
  const rows = await query(
    "SELECT * FROM contacts WHERE user_id = $1 ORDER BY name ASC",
    [userId],
  );

  return rows.map(mapToContact);
}

export async function getContactById(
  id: string,
  userId: string,
): Promise<Contact | null> {
  const row = await queryOne(
    "SELECT * FROM contacts WHERE id = $1 AND user_id = $2",
    [id, userId],
  );

  if (!row) return null;
  return mapToContact(row);
}

export async function updateContact(
  id: string,
  userId: string,
  updates: Partial<
    Pick<Contact, "name" | "phone" | "email" | "relationship" | "notes">
  >,
): Promise<void> {
  const setClauses: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.phone !== undefined) {
    setClauses.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.relationship !== undefined) {
    setClauses.push(`relationship = $${paramIndex++}`);
    values.push(updates.relationship);
  }
  if (updates.notes !== undefined) {
    setClauses.push(`notes = $${paramIndex++}`);
    values.push(updates.notes);
  }

  values.push(id, userId);

  await query(
    `UPDATE contacts SET ${setClauses.join(", ")} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
    values,
  );
}

export async function deleteContact(id: string, userId: string): Promise<void> {
  await query("DELETE FROM contacts WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
}

function mapToContact(data: Record<string, unknown>): Contact {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    phone: data.phone as string | undefined,
    email: data.email as string | undefined,
    relationship: data.relationship as string | undefined,
    notes: data.notes as string | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
