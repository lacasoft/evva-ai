import { generateId } from "@evva/core";
import { query, queryOne } from "../client.js";

export interface RuntimeSkillConfig {
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, { type: string; description: string }>;
    action: {
      type: "http_request";
      url: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: string;
    };
    responseMapping?: string;
  }>;
}

export interface RuntimeSkillRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  config: RuntimeSkillConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function createRuntimeSkill(params: {
  userId: string;
  name: string;
  description: string;
  category?: string;
  config: RuntimeSkillConfig;
}): Promise<RuntimeSkillRecord> {
  const id = generateId();
  const row = await queryOne(
    `INSERT INTO runtime_skills (id, user_id, name, description, category, config)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, name) DO UPDATE SET
       description = $4, category = $5, config = $6, is_active = true, updated_at = NOW()
     RETURNING *`,
    [
      id,
      params.userId,
      params.name,
      params.description,
      params.category ?? "utility",
      JSON.stringify(params.config),
    ],
  );
  if (!row) throw new Error("Failed to create runtime skill");
  return mapToRuntimeSkill(row);
}

export async function getUserRuntimeSkills(
  userId: string,
): Promise<RuntimeSkillRecord[]> {
  const rows = await query(
    "SELECT * FROM runtime_skills WHERE user_id = $1 AND is_active = true ORDER BY name",
    [userId],
  );
  return rows.map(mapToRuntimeSkill);
}

export async function disableRuntimeSkill(
  id: string,
  userId: string,
): Promise<void> {
  await query(
    "UPDATE runtime_skills SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
}

export async function deleteRuntimeSkill(
  id: string,
  userId: string,
): Promise<void> {
  await query("DELETE FROM runtime_skills WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
}

function mapToRuntimeSkill(d: Record<string, unknown>): RuntimeSkillRecord {
  const config =
    typeof d.config === "string" ? JSON.parse(d.config as string) : d.config;
  return {
    id: d.id as string,
    userId: d.user_id as string,
    name: d.name as string,
    description: d.description as string,
    category: d.category as string,
    config: config as RuntimeSkillConfig,
    isActive: d.is_active as boolean,
    createdAt: new Date(d.created_at as string),
    updatedAt: new Date(d.updated_at as string),
  };
}
