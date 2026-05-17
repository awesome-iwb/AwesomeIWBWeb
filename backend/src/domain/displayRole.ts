import { isSuperadmin } from "../services/capabilities";

/** Capability-inferred role for UI and admin filters (not the legacy users.role column). */
export type DisplayRole = "superadmin" | "ops" | "editor" | "dev" | "user";

/** System-level ops capabilities — distinguish full 运维 from 编者. */
export const OPS_MARKER_CAPABILITIES = [
  "user:manage",
  "user:delete",
  "audit:read",
  "org:manage",
  "analytics:read",
] as const;

/** Content / review capabilities typical of the 编者 template. */
export const EDITOR_MARKER_CAPABILITIES = [
  "story:manage",
  "category:manage",
  "submission:read",
  "submission:approve",
  "submission:reject",
  "moderation:read",
  "moderation:approve",
  "moderation:reject",
  "media:manage",
] as const;

export function inferDisplayRole(capabilities: string[], username?: string): DisplayRole {
  if (username && isSuperadmin(username)) return "superadmin";
  const caps = new Set(capabilities);
  if (OPS_MARKER_CAPABILITIES.some((id) => caps.has(id))) return "ops";
  if (caps.has("admin_panel_access")) {
    if (EDITOR_MARKER_CAPABILITIES.some((id) => caps.has(id))) return "editor";
    return "ops";
  }
  if (caps.has("dev_panel_access")) return "dev";
  return "user";
}

export function displayRoleLabel(role: DisplayRole): string {
  switch (role) {
    case "superadmin":
      return "超级管理员";
    case "ops":
      return "运维";
    case "editor":
      return "编者";
    case "dev":
      return "开发者";
    case "user":
      return "用户";
  }
}

export function displayRoleMatchesFilter(role: DisplayRole, filter: string): boolean {
  if (!filter) return true;
  if (filter === "ops") return role === "ops" || role === "superadmin";
  return role === filter;
}

function sqlCapExists(capabilityId: string): string {
  return `exists (
    select 1 from user_capabilities uc
    where uc.user_id = users.id and uc.capability_id = '${capabilityId}'
  )`;
}

function sqlCapAny(capabilityIds: readonly string[]): string {
  const list = capabilityIds.map((id) => `'${id}'`).join(", ");
  return `exists (
    select 1 from user_capabilities uc
    where uc.user_id = users.id and uc.capability_id in (${list})
  )`;
}

/** SQL predicate for admin user list role filter (capabilities-based). */
export function buildDisplayRoleFilterSql(filterRole: string): string | null {
  if (!filterRole) return null;
  const opsMarkers = sqlCapAny(OPS_MARKER_CAPABILITIES);
  const editorMarkers = sqlCapAny(EDITOR_MARKER_CAPABILITIES);
  const adminPanel = sqlCapExists("admin_panel_access");
  const devPanel = sqlCapExists("dev_panel_access");

  switch (filterRole) {
    case "ops":
      return `(${opsMarkers} or (${adminPanel} and not (${editorMarkers})))`;
    case "editor":
      return `(${adminPanel} and not (${opsMarkers}) and (${editorMarkers}))`;
    case "dev":
      return devPanel;
    case "user":
      return `(not ${devPanel} and not ${adminPanel} and not (${opsMarkers}))`;
    default:
      return null;
  }
}

export function inferDisplayRoleFromCapabilitySet(capabilities: Iterable<string>): DisplayRole {
  return inferDisplayRole([...capabilities]);
}
