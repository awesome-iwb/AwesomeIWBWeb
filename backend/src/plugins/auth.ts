import { Elysia } from "elysia";
import { verifyJwt, hashToken } from "../utils/jwt";
import { findUserById } from "../services/users";
import { findActiveTokenByHash, recordTokenUsage } from "../services/apiTokens";
import { findLocalAccountByUsername } from "../services/localAccounts";

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
  async ({ headers }): Promise<AuthContext> => {
    // JSON mode: skip auth unless explicitly testing
    if (!dbEnabled) {
      return { user: null };
    }

    const authHeader = headers["authorization"] ?? "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) {
      return { user: null };
    }

    const token = bearerMatch[1];

    // Try JWT first
    const jwtPayload = verifyJwt(token);
    if (jwtPayload) {
      // Local account JWT (sub format: "local:<id>")
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

      // Regular OAuth user JWT
      const dbUser = await findUserById(jwtPayload.sub);
      if (dbUser && dbUser.is_active) {
        return {
          user: {
            id: dbUser.id,
            name: dbUser.name,
            role: dbUser.role,
            avatar_url: dbUser.avatar_url,
          },
        };
      }
      // JWT valid but user not in DB or inactive
      return { user: null };
    }

    // Try API token
    const tokenHash = hashToken(token);
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
