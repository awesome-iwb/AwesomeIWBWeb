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

const DEFAULT_ADMIN_USERNAME = "lincube";
const SUPERADMIN_INITIAL_PASSWORD = process.env.SUPERADMIN_INITIAL_PASSWORD ?? "";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

// In-memory fallback for JSON mode (not recommended for production)
let memoryAccount: LocalAccount | null = null;

async function ensureDefaultAccount(): Promise<void> {
  if (!dbEnabled) {
    if (!memoryAccount) {
      const password = SUPERADMIN_INITIAL_PASSWORD || "changeme-local-dev";
      memoryAccount = {
        id: "local-admin-1",
        username: DEFAULT_ADMIN_USERNAME,
        password_hash: await argon2.hash(password, ARGON2_OPTIONS),
        role: "ops",
        is_active: true,
        last_login_at: null,
        failed_attempts: 0,
        locked_until: null,
        must_change_password: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return;
  }
}

export async function findLocalAccountByUsername(username: string): Promise<LocalAccount | null> {
  await ensureDefaultAccount();

  if (!dbEnabled) {
    if (memoryAccount && memoryAccount.username === username) return memoryAccount;
    return null;
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
    if (memoryAccount) {
      memoryAccount.last_login_at = new Date().toISOString();
      memoryAccount.failed_attempts = 0;
      memoryAccount.locked_until = null;
      memoryAccount.role = "ops";
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
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  return rules.every(Boolean);
}

export async function setLocalAccountPassword(username: string, password: string, mustChangePassword = false) {
  if (username !== DEFAULT_ADMIN_USERNAME) {
    throw new Error("LOCAL_ACCOUNT_WRITE_FORBIDDEN");
  }
  if (!validateSuperadminPassword(password)) {
    throw new Error("WEAK_PASSWORD");
  }
  const nextHash = await argon2.hash(password, ARGON2_OPTIONS);
  if (!dbEnabled) {
    if (!memoryAccount) await ensureDefaultAccount();
    if (!memoryAccount) throw new Error("SUPERADMIN_NOT_INITIALIZED");
    memoryAccount.password_hash = nextHash;
    memoryAccount.must_change_password = mustChangePassword;
    memoryAccount.role = "ops";
    memoryAccount.updated_at = new Date().toISOString();
    return;
  }
  await sql()`
    update local_accounts
    set password_hash = ${nextHash}, must_change_password = ${mustChangePassword}, role = 'ops', updated_at = now()
    where username = ${DEFAULT_ADMIN_USERNAME}
  `;
}

export async function ensureSuperadminInitialized() {
  await ensureDefaultAccount();
  if (!dbEnabled) return;
  const rows = await sql()<LocalAccount[]>`
    select id, username, password_hash, role, is_active, last_login_at, failed_attempts, locked_until, must_change_password, created_at, updated_at
    from local_accounts where username = ${DEFAULT_ADMIN_USERNAME} limit 1
  `;
  if (rows[0]) return;

  if (!SUPERADMIN_INITIAL_PASSWORD && process.env.NODE_ENV === "production") {
    throw new Error("SUPERADMIN_INITIAL_PASSWORD is required in production");
  }
  const generated = SUPERADMIN_INITIAL_PASSWORD || `${Math.random().toString(36).slice(2)}A!9x`;
  const passwordHash = await argon2.hash(generated, ARGON2_OPTIONS);
  await sql()`
    insert into local_accounts (username, password_hash, role, is_active, must_change_password)
    values (${DEFAULT_ADMIN_USERNAME}, ${passwordHash}, 'ops', true, true)
  `;
  if (!SUPERADMIN_INITIAL_PASSWORD && process.env.NODE_ENV !== "production") {
    console.warn(`[security] generated superadmin password for lincube: ${generated}`);
  }
  console.warn("[security] 已创建超管账号 lincube，请立即登录修改密码");
  await logAudit({
    action: "superadmin_seeded",
    entity_type: "local_account",
    entity_id: DEFAULT_ADMIN_USERNAME,
    diff: { must_change_password: true }
  }).catch(() => {});
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES };
