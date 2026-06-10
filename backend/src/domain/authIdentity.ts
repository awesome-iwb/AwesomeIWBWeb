export type AuthIdentity = {
  id: string;
  name: string;
  role: "user" | "dev" | "ops";
  auth_type?: "user" | "local" | "api_token";
  avatar_url?: string;
};

export function isApiTokenIdentity(user: Pick<AuthIdentity, "id" | "auth_type"> | null | undefined): boolean {
  return user?.auth_type === "api_token" || String(user?.id ?? "").startsWith("token:");
}

export function isLocalIdentity(user: Pick<AuthIdentity, "id" | "auth_type"> | null | undefined): boolean {
  return user?.auth_type === "local" || String(user?.id ?? "").startsWith("local:");
}

export function userIdForForeignKey(user: Pick<AuthIdentity, "id" | "auth_type"> | null | undefined): string | null {
  if (!user || isApiTokenIdentity(user)) return null;
  return user.id;
}

export function realUserId(user: Pick<AuthIdentity, "id" | "auth_type"> | null | undefined): string | null {
  if (!user || isApiTokenIdentity(user)) return null;
  return user.id;
}

const API_TOKEN_CAPABILITIES = new Set([
  "project:read",
  "project:create",
  "project:update",
  "project:import",
  "project:export",
  "category:manage",
  "media:read",
  "analytics:read",
]);

export function apiTokenCanUseCapability(capabilityId: string): boolean {
  return API_TOKEN_CAPABILITIES.has(capabilityId);
}
