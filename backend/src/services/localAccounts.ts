import { sql } from "../db/client";
import argon2 from "argon2";
import { logAudit } from "./audit";

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
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

// Default seed username for the bootstrap super admin. Historically this was
// "lincube"; it can be overridden via SUPERADMIN_INITIAL_USERNAME env var.
// Note: this is ONLY a seed default. Any user with role='ops' (in the `users`
// table) is allowed to log in via password.
const SUPERADMIN_INITIAL_USERNAME = (process.env.SUPERADMIN_INITIAL_USERNAME ?? "lincube").trim();
const SUPERADMIN_INITIAL_PASSWORD = process.env.SUPERADMIN_INITIAL_PASSWORD ?? "";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

// In-memory accounts for JSON mode (keyed by username)
const memoryAccounts = new Map<string, LocalAccount>();

async function ensureDefaultAccount(username: string): Promise<void> {
  if (!dbEnabled) {
    // JSON mode is ONLY allowed in development/testing
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production; JSON mode is not allowed");
    }
    // JSON mode: only allow the configured default username
    if (username !== SUPERADMIN_INITIAL_USERNAME) {
      return;
    }
    if (!memoryAccounts.has(username)) {
      const password = SUPERADMIN_INITIAL_PASSWORD || "changeme-local-dev";
      memoryAccounts.set(username, {
        id: `local-admin-${username}`,
        username: username,
        password_hash: await argon2.hash(password, ARGON2_OPTIONS),
        role: "ops",
        is_active: true,
        last_login_at: null,
        failed_attempts: 0,
        locked_until: null,
        must_change_password: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return;
  }
}

export async function findLocalAccountByUsername(username: string): Promise<LocalAccount | null> {
  await ensureDefaultAccount(username);

  if (!dbEnabled) {
    return memoryAccounts.get(username) ?? null;
  }

  const rows = await sql()<LocalAccount[]>`
    select id, username, password_hash, role, is_active, last_login_at, failed_attempts, locked_until, must_change_password, created_at, updated_at
    from local_accounts where username = ${username} limit 1
  `;
  return rows[0] ?? null;
}

export async function verifyLocalPassword(account: LocalAccount, password: string): Promise<boolean> {
  return argon2.verify(account.password_hash, password);
}

export async function dummyVerifyPassword(password: string): Promise<void> {
  const fakeHash = await argon2.hash("not-the-real-password", ARGON2_OPTIONS);
  await argon2.verify(fakeHash, password).catch(() => false);
}

export async function recordLoginSuccess(id: string): Promise<void> {
  if (!dbEnabled) {
    for (const account of memoryAccounts.values()) {
      if (account.id === id) {
        account.last_login_at = new Date().toISOString();
        account.failed_attempts = 0;
        account.locked_until = null;
        account.role = "ops";
        break;
      }
    }
    return;
  }

  await sql()`
    update local_accounts
    set last_login_at = now(), failed_attempts = 0, locked_until = null, role = 'ops'
    where id = ${id}
  `;
}

export async function recordLoginFailure(id: string): Promise<void> {
  if (!dbEnabled) {
    for (const account of memoryAccounts.values()) {
      if (account.id === id) {
        account.failed_attempts++;
        if (account.failed_attempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
          account.locked_until = lockUntil.toISOString();
        }
        break;
      }
    }
    return;
  }

  await sql()`
    update local_accounts
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} then now() + interval '${LOCKOUT_DURATION_MINUTES} minutes' else locked_until end,
        role = 'ops'
    where id = ${id}
  `;
}

export function isAccountLocked(account: LocalAccount): boolean {
  if (!account.locked_until) return false;
  return new Date(account.locked_until) > new Date();
}

export function validateSuperadminPassword(password: string) {
  const rules = [
    password.length >= 8,
    /[a-z]/.test(password),
    /\d/.test(password)
  ];
  return rules.every(Boolean);
}

/**
 * Look up a `users` row by name. Returns null if the table doesn't exist
 * (e.g. JSON mode) or no match. Used to enforce role-based gates without
 * creating an import cycle with services/users.ts.
 */
async function findUserRowByName(username: string): Promise<{ id: string; role: string } | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Array<{ id: string; role: string }>>`
    select id, role from users where name = ${username} limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Ensure a `users` row exists for the given seed superadmin username with
 * role='ops'. Idempotent. Skipped in JSON mode.
 */
async function ensureSuperadminUserRow(username: string): Promise<void> {
  if (!dbEnabled) return;
  const existing = await findUserRowByName(username);
  if (existing) {
    if (existing.role !== "ops") {
      await sql()`update users set role = 'ops' where id = ${existing.id}`;
    }
    return;
  }
  await sql()`
    insert into users (name, avatar_url, role, is_active)
    values (${username}, '', 'ops', true)
    on conflict do nothing
  `;
}

/**
 * Enforce that password-based login (and password writes) are restricted to
 * users whose `users.role === 'ops'`. The seed superadmin username is allowed
 * even if no `users` row exists yet (bootstrap path).
 *
 * Throws Error("LOCAL_LOGIN_NOT_ALLOWED") otherwise.
 */
export async function assertOpsRoleForLocalLogin(username: string): Promise<void> {
  if (!dbEnabled) return;
  const user = await findUserRowByName(username);
  if (!user) {
    if (username === SUPERADMIN_INITIAL_USERNAME) {
      // Seed bootstrap path: users row may not yet exist.
      await ensureSuperadminUserRow(username);
      return;
    }
    throw new Error("LOCAL_LOGIN_NOT_ALLOWED");
  }
  if (user.role !== "ops") {
    throw new Error("LOCAL_LOGIN_NOT_ALLOWED");
  }
}

export async function setLocalAccountPassword(username: string, password: string, mustChangePassword = false) {
  if (!validateSuperadminPassword(password)) {
    throw new Error("WEAK_PASSWORD");
  }
  // Password login is gated to ops-role users (with seed bootstrap exception).
  await assertOpsRoleForLocalLogin(username);

  const nextHash = await argon2.hash(password, ARGON2_OPTIONS);
  if (!dbEnabled) {
    await ensureDefaultAccount(username);
    let account = memoryAccounts.get(username);
    if (!account) {
      // In JSON mode, allow creating new local accounts on demand for tests/dev.
      account = {
        id: `local-admin-${username}`,
        username,
        password_hash: nextHash,
        role: "ops",
        is_active: true,
        last_login_at: null,
        failed_attempts: 0,
        locked_until: null,
        must_change_password: mustChangePassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryAccounts.set(username, account);
      return;
    }
    account.password_hash = nextHash;
    account.must_change_password = mustChangePassword;
    account.role = "ops";
    account.updated_at = new Date().toISOString();
    return;
  }
  // Upsert local_accounts row so this works for any ops user, not just lincube.
  await sql()`
    insert into local_accounts (username, password_hash, role, is_active, must_change_password)
    values (${username}, ${nextHash}, 'ops', true, ${mustChangePassword})
    on conflict (username) do update set
      password_hash = excluded.password_hash,
      must_change_password = excluded.must_change_password,
      role = 'ops',
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  `;
}

/**
 * Seed the bootstrap superadmin account if it doesn't already exist.
 *
 * Optional `username` override is mostly for tests; production uses the
 * `SUPERADMIN_INITIAL_USERNAME` env var (default "lincube").
 *
 * IMPORTANT: This only creates ONE account. Additional ops users are managed
 * via the admin UI / `set-user-role` script and can use password login as
 * long as their `users.role === 'ops'`.
 */
export async function ensureSuperadminInitialized(username?: string) {
  const target = (username ?? SUPERADMIN_INITIAL_USERNAME).trim();
  await ensureDefaultAccount(target);
  if (!dbEnabled) return;

  await ensureSuperadminUserRow(target);

  const rows = await sql()<LocalAccount[]>`
    select id, username, password_hash, role, is_active, last_login_at, failed_attempts, locked_until, must_change_password, created_at, updated_at
    from local_accounts where username = ${target} limit 1
  `;
  if (rows[0]) return;

  if (!SUPERADMIN_INITIAL_PASSWORD && process.env.NODE_ENV === "production") {
    throw new Error("SUPERADMIN_INITIAL_PASSWORD is required in production");
  }
  const generated = SUPERADMIN_INITIAL_PASSWORD || `${Math.random().toString(36).slice(2)}A!9x`;
  const passwordHash = await argon2.hash(generated, ARGON2_OPTIONS);
  await sql()`
    insert into local_accounts (username, password_hash, role, is_active, must_change_password)
    values (${target}, ${passwordHash}, 'ops', true, true)
    on conflict (username) do nothing
  `;
  if (!SUPERADMIN_INITIAL_PASSWORD && process.env.NODE_ENV !== "production") {
    console.warn(`[security] generated superadmin password for ${target}: ${generated}`);
  }
  console.warn(`[security] 已创建超管账号 ${target}，请立即登录修改密码`);
  await logAudit({
    action: "superadmin_seeded",
    entity_type: "local_account",
    entity_id: target,
    diff: { must_change_password: true }
  }).catch(() => {});
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES, SUPERADMIN_INITIAL_USERNAME };
