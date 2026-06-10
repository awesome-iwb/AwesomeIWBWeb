import { randomUUID } from "crypto";
import { Elysia } from "elysia";
import { verifyJwt, hashToken } from "../utils/jwt";
import { findUserById, findUserByName } from "../services/users";
import { findActiveTokenByHash, recordTokenUsage } from "../services/apiTokens";
import { findLocalAccountByUsername } from "../services/localAccounts";
import { userHasCapability, isSuperadmin } from "../services/capabilities";
import { appConfig } from "../config";
import { parseCookieHeader } from "../utils/cookies";
import { apiTokenCanUseCapability, isApiTokenIdentity, type AuthIdentity } from "../domain/authIdentity";

export type AuthUser = AuthIdentity;

export type AuthContext = {
  user: AuthUser | null;
};

const dbEnabled = Boolean(process.env.DATABASE_URL);

function authError(set: any, status: number, code: string, message: string) {
  const traceId = randomUUID();
  set.status = status;
  return { error: { code, message, traceId } };
}

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
          const dbUser = await findUserByName(account.username);
          if (!dbUser || !dbUser.is_active) return { user: null };
          if ((jwtPayload.tv ?? 0) !== (dbUser.token_version ?? 0)) return { user: null };
          return {
            user: {
              id: dbUser.id,
              name: dbUser.name,
              role: dbUser.role,
              auth_type: "local",
              avatar_url: dbUser.avatar_url,
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
            auth_type: "user",
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
            name: `api-token:${apiToken.name}`,
            role: apiToken.role,
            auth_type: "api_token",
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
      return authError(set, 401, "UNAUTHORIZED", "Unauthorized");
    }
  };
}

export function requireCapability(capabilityId: string) {
  return async ({ user, set }: { user: AuthUser | null; set: any }) => {
    if (!dbEnabled) return;
    if (!user) {
      return authError(set, 401, "UNAUTHORIZED", "Unauthorized");
    }
    if (isApiTokenIdentity(user)) {
      if (apiTokenCanUseCapability(capabilityId)) return;
      return authError(set, 403, "FORBIDDEN", "Forbidden: API token cannot use this capability");
    }
    if (isSuperadmin(user.name)) return;
    const has = await userHasCapability(user.id, user.name, capabilityId);
    if (!has) {
      return authError(set, 403, "FORBIDDEN", "Forbidden: insufficient capability");
    }
  };
}

export function requireProjectMember(getProjectId: (context: { params: Record<string, string> }) => string) {
  return async ({ user, set, params }: { user: AuthUser | null; set: any; params: Record<string, string> }) => {
    if (!dbEnabled) return;
    if (!user) {
      return authError(set, 401, "UNAUTHORIZED", "Unauthorized");
    }
    if (isApiTokenIdentity(user)) {
      return authError(set, 403, "FORBIDDEN", "Forbidden: API token cannot use project membership routes");
    }
    if (isSuperadmin(user.name)) return;
    const hasCap = await userHasCapability(user.id, user.name, "dev:project_edit");
    if (!hasCap) {
      return authError(set, 403, "FORBIDDEN", "Forbidden: insufficient capability");
    }
    const projectId = getProjectId({ params });
    const { isProjectMember } = await import("../services/projectMembers");
    const isMember = await isProjectMember(projectId, user.id);
    if (!isMember) {
      return authError(set, 403, "FORBIDDEN", "Forbidden: not a project member");
    }
  };
}
