import { Elysia, t } from "elysia";
import { signJwt } from "../utils/jwt";
import {
  dummyVerifyPassword,
  ensureSuperadminInitialized,
  findLocalAccountByUsername,
  isAccountLocked,
  recordLoginFailure,
  recordLoginSuccess,
  setLocalAccountPassword,
  verifyLocalPassword,
} from "../services/localAccounts";
import { logAudit } from "../services/audit";
import { setSessionCookie } from "../utils/cookies";

const dbEnabled = Boolean(process.env.DATABASE_URL);
const SUPERADMIN_USERNAME = "lincube";

// Simple in-memory rate limiter per IP
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const IP_MAX_ATTEMPTS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
let superadminFailureWindow = { count: 0, resetAt: 0 };
let superadminLockUntil = 0;

function getClientIp(headers: Record<string, string | undefined>): string {
  return (
    headers["x-forwarded-for"] ??
    headers["x-real-ip"] ??
    "unknown"
  ).split(",")[0].trim();
}

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return true;
  }

  if (entry.count >= IP_MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

function cleanOldIpAttempts() {
  const now = Date.now();
  for (const [ip, entry] of ipAttempts.entries()) {
    if (now > entry.resetAt) {
      ipAttempts.delete(ip);
    }
  }
}

function shouldLockSuperadmin() {
  const now = Date.now();
  if (now > superadminFailureWindow.resetAt) {
    superadminFailureWindow = { count: 0, resetAt: now + 15 * 60 * 1000 };
  }
  if (superadminFailureWindow.count >= 10) {
    superadminLockUntil = Math.max(superadminLockUntil, now + 30 * 60 * 1000);
  }
  return now < superadminLockUntil;
}

function countSuperadminFailure() {
  const now = Date.now();
  if (now > superadminFailureWindow.resetAt) {
    superadminFailureWindow = { count: 0, resetAt: now + 15 * 60 * 1000 };
  }
  superadminFailureWindow.count += 1;
  shouldLockSuperadmin();
}

async function logAttempt(input: {
  ip: string;
  ua: string;
  username: string;
  status: "success" | "failed" | "locked";
  reason: string;
}) {
  await logAudit({
    action: "superadmin_login_attempt",
    entity_type: "local_account",
    entity_id: input.username,
    diff: input
  }).catch(() => {});
}

export const localAuthPlugin = new Elysia({ prefix: "/api/auth" })
  .post(
    "/login",
    async ({ body, set, headers }) => {
      if (!dbEnabled) {
        set.status = 503;
        return { error: { code: "LOCAL_LOGIN_DISABLED", message: "登录失败" } };
      }
      await ensureSuperadminInitialized();

      cleanOldIpAttempts();

      const clientIp = getClientIp(headers);
      const ua = headers["user-agent"] ?? "";
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");

      if (!checkIpRateLimit(clientIp)) {
        set.status = 429;
        set.headers["retry-after"] = String(Math.ceil(IP_WINDOW_MS / 1000));
        await logAttempt({ ip: clientIp, ua, username, status: "locked", reason: "ip_rate_limited" });
        return { error: { code: "RATE_LIMITED", message: "登录失败" } };
      }

      if (username !== SUPERADMIN_USERNAME) {
        await dummyVerifyPassword(password);
        await logAttempt({ ip: clientIp, ua, username, status: "failed", reason: "LOCAL_LOGIN_NOT_ALLOWED" });
        set.status = 403;
        return { error: { code: "LOCAL_LOGIN_NOT_ALLOWED", message: "请使用第三方登录" } };
      }

      if (shouldLockSuperadmin()) {
        set.status = 429;
        set.headers["retry-after"] = "1800";
        await logAttempt({ ip: clientIp, ua, username, status: "locked", reason: "superadmin_global_lock" });
        return { error: { code: "RATE_LIMITED", message: "登录失败" } };
      }

      const account = await findLocalAccountByUsername(username);

      if (!account) {
        countSuperadminFailure();
        await dummyVerifyPassword(password);
        await logAttempt({ ip: clientIp, ua, username, status: "failed", reason: "not_found" });
        set.status = 401;
        return { error: { code: "AUTH_FAILED", message: "登录失败" } };
      }

      if (!account.is_active) {
        set.status = 403;
        await logAttempt({ ip: clientIp, ua, username, status: "failed", reason: "disabled" });
        return { error: { code: "AUTH_FAILED", message: "登录失败" } };
      }

      if (isAccountLocked(account)) {
        set.status = 429;
        set.headers["retry-after"] = "1800";
        await logAttempt({ ip: clientIp, ua, username, status: "locked", reason: "account_locked" });
        return { error: { code: "RATE_LIMITED", message: "登录失败" } };
      }

      const isValid = await verifyLocalPassword(account, password);

      if (!isValid) {
        countSuperadminFailure();
        await recordLoginFailure(account.id);
        await logAttempt({ ip: clientIp, ua, username, status: "failed", reason: "wrong_password" });
        set.status = 401;
        return { error: { code: "AUTH_FAILED", message: "登录失败" } };
      }

      // Success
      await recordLoginSuccess(account.id);
      superadminFailureWindow = { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
      superadminLockUntil = 0;

      const jwt = signJwt({
        sub: `local:${account.id}`,
        name: account.username,
        role: account.role,
        tv: 0
      });

      await logAttempt({ ip: clientIp, ua, username, status: "success", reason: "ok" });
      setSessionCookie(set, jwt);

      return {
        user: {
          id: `local:${account.id}`,
          name: account.username,
          role: account.role,
          avatar_url: "",
        },
        mustChangePassword: account.must_change_password,
        token: jwt
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 100 }),
        password: t.String({ minLength: 1, maxLength: 200 }),
      }),
    }
  )
  .post("/refresh", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: { code: "UNAUTHORIZED", message: "登录失败" } };
    }
    const jwt = signJwt({
      sub: String(user.id),
      name: user.name,
      role: user.role,
      tv: 0
    });
    setSessionCookie(set, jwt);
    return { success: true };
  })
  .post(
    "/superadmin/change-password",
    async ({ body, headers, set }) => {
      const authHeader = headers["authorization"] ?? "";
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        set.status = 401;
        return { error: { code: "UNAUTHORIZED", message: "登录失败" } };
      }
      const { verifyJwt } = await import("../utils/jwt");
      const payload = verifyJwt(match[1]);
      if (!payload || payload.name !== SUPERADMIN_USERNAME) {
        set.status = 403;
        return { error: { code: "FORBIDDEN", message: "登录失败" } };
      }
      const account = await findLocalAccountByUsername(SUPERADMIN_USERNAME);
      if (!account) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "登录失败" } };
      }
      const ok = await verifyLocalPassword(account, String(body.currentPassword ?? ""));
      if (!ok) {
        set.status = 401;
        return { error: { code: "AUTH_FAILED", message: "登录失败" } };
      }
      await setLocalAccountPassword(SUPERADMIN_USERNAME, String(body.newPassword ?? ""), false);
      await logAudit({
        action: "superadmin_password_changed",
        entity_type: "local_account",
        entity_id: SUPERADMIN_USERNAME,
        diff: { ip: getClientIp(headers), ua: headers["user-agent"] ?? "" }
      }).catch(() => {});
      return { success: true };
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1, maxLength: 200 }),
        newPassword: t.String({ minLength: 12, maxLength: 200 })
      })
    }
  )
  .get("/local/status", async ({ set }) => {
    if (!dbEnabled) {
      return { enabled: false, reason: "Database mode required" };
    }

    const account = await findLocalAccountByUsername("lincube");
    return {
      enabled: true,
      accountExists: !!account,
      accountActive: account?.is_active ?? false,
    };
  });
