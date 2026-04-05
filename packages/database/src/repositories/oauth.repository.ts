import { generateId } from "@evva/core";
import { query, queryOne } from "../client.js";

export interface OAuthToken {
  id: string;
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function getOAuthToken(
  userId: string,
  provider: string,
): Promise<OAuthToken | null> {
  const row = await queryOne(
    "SELECT * FROM oauth_tokens WHERE user_id = $1 AND provider = $2",
    [userId, provider],
  );

  if (!row) return null;
  return mapToToken(row);
}

export async function upsertOAuthToken(params: {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: Date;
}): Promise<OAuthToken> {
  const id = generateId();

  const row = await queryOne(
    `INSERT INTO oauth_tokens (id, user_id, provider, access_token, refresh_token, scope, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id, provider) DO UPDATE SET
       access_token = $4,
       refresh_token = COALESCE($5, oauth_tokens.refresh_token),
       scope = COALESCE($6, oauth_tokens.scope),
       expires_at = $7,
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      params.userId,
      params.provider,
      params.accessToken,
      params.refreshToken ?? null,
      params.scope ?? null,
      params.expiresAt?.toISOString() ?? null,
    ],
  );

  if (!row) throw new Error("Failed to upsert OAuth token");
  return mapToToken(row);
}

export async function deleteOAuthToken(
  userId: string,
  provider: string,
): Promise<void> {
  await query("DELETE FROM oauth_tokens WHERE user_id = $1 AND provider = $2", [
    userId,
    provider,
  ]);
}

function mapToToken(data: Record<string, unknown>): OAuthToken {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    provider: data.provider as string,
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    tokenType: data.token_type as string,
    scope: data.scope as string | undefined,
    expiresAt: data.expires_at
      ? new Date(data.expires_at as string)
      : undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}
