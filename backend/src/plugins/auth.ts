import { Elysia } from "elysia";
import { verifyJwt, hashToken } from "../utils/jwt";
import { findUserById } from "../services/users";
import { findActiveTokenByHash, recordTokenUsage } from "../services/apiTokens";
import { findLocalAccountByUsername } from "../services/localAccounts";
import { userHasCapability, isSuperadmin } from "../services/capabilities";
import { appConfig } from "../config";
import { parseCookieHeader } from "../utils/cookies";

export type AuthUser = {
  id: string;
  name: string;
  role: "user" | "dev" | "ops";
  avatar_url?: string;
};

export type AuthContext = {
  user: AuthUser | null;
};

const dbEnabled = Boolean(process.env.DATABASE_URL);
const devAllowDemoAdmin = process.env.DEV_ALLOW_DEMO_ADMIN === "true";

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "global" },
  async ({ headers, path }): Promise<AuthContext> => {
    if (!dbEnabled) {
      return { user: null };
    }

    const cookies = parseCookieHeader(headers["cookie"]);
    const authHeader = headers["authorization"] ?? "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = cookies[appConfig.sessionCookieName] || bearerMatch?.[1];
    if (!token) return { user: null };

    const jwtPayload = verifyJwt(token, { iss: appConfig.jwtIssuer, aud: appConfig.jwtAudience });
    if (jwtPayload) {
      if (jwtPayload.sub.startsWith("local:")) {
        const localId = jwtPayload.sub.slice(6);
        const account = await findLocalAccountByUsername(jwtPayload.name);
        if (account && account.id === localId && account.is_active) {
          return {
            user: {
              id: jwtPayload.sub,
              name: account.username,
              role: account.role,
              avatar_url: "",
            },
          };
        }
        return { user: null };
      }

      const dbUser = await findUserById(jwtPayload.sub);
      if (dbUser && dbUser.is_active && (jwtPayload.tv ?? 0) === (dbUser.token_version ?? 0)) {
        return {
          user: {
            id: dbUser.id,
            name: dbUser.name,
            role: dbUser.role,
            avatar_url: dbUser.avatar_url,
          },
        };
      }
      return { user: null };
    }

    if (bearerMatch?.[1]) {
      const tokenHash = hashToken(bearerMatch[1]);
      const apiToken = await findActiveTokenByHash(tokenHash);
      if (apiToken) {
        void recordTokenUsage(tokenHash);
        return {
          user: {
            id: `token:${apiToken.id}`,
            name: apiToken.name,
            role: apiToken.role,
          },
        };
      }
    }

    return { user: null };
  }
);

export function requireAuth() {
  return ({ user, set }: { user: AuthUser | null; set: any }) => {
    if (!dbEnabled) return;
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  };
}

export function requireRole(allowedRoles: Array<"user" | "dev" | "ops">) {
  return ({ user, set }: { user: AuthUser | null; set: any }) => {
    if (!dbEnabled) return;
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (!allowedRoles.includes(user.role)) {
      set.status = 403;
      return { error: "Forbidden: insufficient role" };
    }
  };
}

export function requireAuthOrDev() {
  return ({ user, set }: { user: AuthUser | null; set: any }) => {
    if (!dbEnabled) return;
    if (!user && !devAllowDemoAdmin) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  };
}

export function requireCapability(capabilityId: string) {
  return async ({ user, set }: { user: AuthUser | null; set: any }) => {
    if (!dbEnabled) return;
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (isSuperadmin(user.name)) return;
    if (user.id.startsWith("token:")) return;
    const has = await userHasCapability(user.id, user.name, capabilityId);
    if (!has) {
      set.status = 403;
      return { error: "Forbidden: insufficient capability" };
    }
  };
}
