import { sql } from "../db/client";
import { hashToken } from "../utils/jwt";

const dbEnabled = Boolean(process.env.DATABASE_URL);

// In-memory store for JSON mode
const memoryTokens: Map<string, ApiToken> = new Map();
let memoryTokenIdCounter = 1;

export type ApiToken = {
  id: string;
  token_hash: string;
  name: string;
  role: "ops";
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export async function findActiveTokenByHash(tokenHash: string): Promise<ApiToken | null> {
  if (!dbEnabled) {
    for (const token of memoryTokens.values()) {
      if (token.token_hash === tokenHash && token.is_active) {
        if (token.expires_at && new Date(token.expires_at) < new Date()) return null;
        return token;
      }
    }
    return null;
  }
  const rows = await sql().unsafe(
    `select id, token_hash, name, role, is_active, expires_at, last_used_at, created_at
     from api_tokens
     where token_hash = $1 and is_active = true
     limit 1`,
    [tokenHash]
  );
  const token = (rows as ApiToken[])[0] ?? null;
  if (!token) return null;
  if (token.expires_at && new Date(token.expires_at) < new Date()) return null;
  return token;
}

export async function recordTokenUsage(tokenHash: string) {
  if (!dbEnabled) {
    for (const token of memoryTokens.values()) {
      if (token.token_hash === tokenHash) {
        token.last_used_at = new Date().toISOString();
        break;
      }
    }
    return;
  }
  try {
    await sql().unsafe(
      `update api_tokens set last_used_at = now() where token_hash = $1`,
      [tokenHash]
    );
  } catch {}
}

export async function createApiToken(input: { token: string; name: string; role?: "ops"; expiresAt?: Date }): Promise<ApiToken> {
  const tokenHash = hashToken(input.token);
  if (!dbEnabled) {
    const now = new Date().toISOString();
    const token: ApiToken = {
      id: `mem-token-${memoryTokenIdCounter++}`,
      token_hash: tokenHash,
      name: input.name,
      role: input.role ?? "ops",
      is_active: true,
      expires_at: input.expiresAt?.toISOString() ?? null,
      last_used_at: null,
      created_at: now,
    };
    memoryTokens.set(token.id, token);
    return token;
  }
  const [row] = await sql()<ApiToken[]>`
    insert into api_tokens (token_hash, name, role, expires_at)
    values (${tokenHash}, ${input.name}, ${input.role ?? "ops"}, ${input.expiresAt ?? null})
    returning id, token_hash, name, role, is_active, expires_at, last_used_at, created_at
  `;
  return row;
}

export async function listApiTokens(): Promise<ApiToken[]> {
  if (!dbEnabled) {
    return Array.from(memoryTokens.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  return await sql()<ApiToken[]>`
    select id, token_hash, name, role, is_active, expires_at, last_used_at, created_at
    from api_tokens
    order by created_at desc
  `;
}

export async function revokeApiToken(id: string): Promise<boolean> {
  if (!dbEnabled) {
    const token = memoryTokens.get(id);
    if (token) {
      token.is_active = false;
      return true;
    }
    return false;
  }
  const result = await sql().unsafe(
    `update api_tokens set is_active = false where id = $1`,
    [id]
  );
  return (result as any[]).length > 0;
}
