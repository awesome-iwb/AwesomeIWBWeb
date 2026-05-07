import { sql } from "../db/client";
import argon2 from "argon2";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type LocalAccount = {
  id: string;
  username: string;
  password_hash: string;
  role: "ops";
  is_active: boolean;
  last_login_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_ADMIN_USERNAME = "lincube";
const DEFAULT_ADMIN_PASSWORD = process.env.LOCAL_ADMIN_PASSWORD ?? "";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// In-memory fallback for JSON mode (not recommended for production)
let memoryAccount: LocalAccount | null = null;

async function ensureDefaultAccount(): Promise<void> {
  if (!dbEnabled) {
    if (!memoryAccount) {
      memoryAccount = {
        id: "local-admin-1",
        username: DEFAULT_ADMIN_USERNAME,
        password_hash: await argon2.hash(DEFAULT_ADMIN_PASSWORD || "changeme"),
        role: "ops",
        is_active: true,
        last_login_at: null,
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return;
  }

  if (!DEFAULT_ADMIN_PASSWORD) return;

  const rows = await sql()<LocalAccount[]>`
    select id, username, password_hash, role, is_active, last_login_at, failed_attempts, locked_until, created_at, updated_at
    from local_accounts where username = ${DEFAULT_ADMIN_USERNAME} limit 1
  `;

  const existing = rows[0];
  const newHash = await argon2.hash(DEFAULT_ADMIN_PASSWORD);

  if (!existing) {
    await sql()`
      insert into local_accounts (username, password_hash, role, is_active)
      values (${DEFAULT_ADMIN_USERNAME}, ${newHash}, 'ops', true)
    `;
  } else if (await argon2.verify(existing.password_hash, DEFAULT_ADMIN_PASSWORD).catch(() => false)) {
    // Password already matches, do nothing
  } else {
    // Update password hash if env changed
    await sql()`
      update local_accounts
      set password_hash = ${newHash}, updated_at = now()
      where id = ${existing.id}
    `;
  }
}

export async function findLocalAccountByUsername(username: string): Promise<LocalAccount | null> {
  await ensureDefaultAccount();

  if (!dbEnabled) {
    if (memoryAccount && memoryAccount.username === username) return memoryAccount;
    return null;
  }

  const rows = await sql()<LocalAccount[]>`
    select id, username, password_hash, role, is_active, last_login_at, failed_attempts, locked_until, created_at, updated_at
    from local_accounts where username = ${username} limit 1
  `;
  return rows[0] ?? null;
}

export async function verifyLocalPassword(account: LocalAccount, password: string): Promise<boolean> {
  return argon2.verify(account.password_hash, password);
}

export async function recordLoginSuccess(id: string): Promise<void> {
  if (!dbEnabled) {
    if (memoryAccount) {
      memoryAccount.last_login_at = new Date().toISOString();
      memoryAccount.failed_attempts = 0;
      memoryAccount.locked_until = null;
    }
    return;
  }

  await sql()`
    update local_accounts
    set last_login_at = now(), failed_attempts = 0, locked_until = null
    where id = ${id}
  `;
}

export async function recordLoginFailure(id: string): Promise<void> {
  if (!dbEnabled) {
    if (memoryAccount) {
      memoryAccount.failed_attempts++;
      if (memoryAccount.failed_attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        memoryAccount.locked_until = lockUntil.toISOString();
      }
    }
    return;
  }

  await sql()`
    update local_accounts
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} then now() + interval '${LOCKOUT_DURATION_MINUTES} minutes' else locked_until end
    where id = ${id}
  `;
}

export function isAccountLocked(account: LocalAccount): boolean {
  if (!account.locked_until) return false;
  return new Date(account.locked_until) > new Date();
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES };
