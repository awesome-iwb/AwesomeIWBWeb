import { Elysia, t } from "elysia";
import { signJwt } from "../utils/jwt";
import {
  findLocalAccountByUsername,
  verifyLocalPassword,
  recordLoginSuccess,
  recordLoginFailure,
  isAccountLocked,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
} from "../services/localAccounts";
import { logAudit } from "../services/audit";

const dbEnabled = Boolean(process.env.DATABASE_URL);

// Simple in-memory rate limiter per IP
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const IP_MAX_ATTEMPTS = 10;
const IP_WINDOW_MS = 60 * 1000; // 1 minute

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

export const localAuthPlugin = new Elysia({ prefix: "/api/auth" })
  .post(
    "/local/login",
    async ({ body, set, headers }) => {
      if (!dbEnabled) {
        set.status = 503;
        return { error: "Local login requires database mode" };
      }

      cleanOldIpAttempts();

      const clientIp = getClientIp(headers);
      if (!checkIpRateLimit(clientIp)) {
        set.status = 429;
        return { error: "Too many attempts. Please try again later." };
      }

      const { username, password } = body;

      const account = await findLocalAccountByUsername(username);

      if (!account) {
        // Log failed attempt without revealing whether username exists
        await logAudit({
          action: "local_login_failed",
          entity_type: "local_account",
          entity_id: username,
          diff: { reason: "invalid_credentials", ip: clientIp },
        }).catch(() => {});

        set.status = 401;
        return { error: "Invalid username or password" };
      }

      if (!account.is_active) {
        set.status = 403;
        return { error: "Account is disabled" };
      }

      if (isAccountLocked(account)) {
        const lockedUntil = new Date(account.locked_until!);
        const minutesLeft = Math.ceil(
          (lockedUntil.getTime() - Date.now()) / 60000
        );

        set.status = 429;
        return {
          error: `Account is locked. Try again in ${minutesLeft} minute(s).`,
          lockedUntil: account.locked_until,
        };
      }

      const isValid = await verifyLocalPassword(account, password);

      if (!isValid) {
        await recordLoginFailure(account.id);
        const remainingAttempts = Math.max(
          0,
          MAX_FAILED_ATTEMPTS - (account.failed_attempts + 1)
        );

        await logAudit({
          action: "local_login_failed",
          entity_type: "local_account",
          entity_id: account.id,
          diff: {
            reason: "wrong_password",
            ip: clientIp,
            remaining_attempts: remainingAttempts,
          },
        }).catch(() => {});

        set.status = 401;
        return {
          error: "Invalid username or password",
          remainingAttempts:
            remainingAttempts > 0 ? remainingAttempts : undefined,
        };
      }

      // Success
      await recordLoginSuccess(account.id);

      const jwt = signJwt({
        sub: `local:${account.id}`,
        name: account.username,
        role: account.role,
      });

      await logAudit({
        action: "local_login_success",
        entity_type: "local_account",
        entity_id: account.id,
        diff: { ip: clientIp },
      }).catch(() => {});

      return {
        token: jwt,
        user: {
          id: `local:${account.id}`,
          name: account.username,
          role: account.role,
          avatar_url: "",
        },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 100 }),
        password: t.String({ minLength: 1, maxLength: 200 }),
      }),
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
