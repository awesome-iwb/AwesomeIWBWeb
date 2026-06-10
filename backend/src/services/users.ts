import { sql } from "../db/client";
import {
  displayRoleMatchesFilter,
  displayRoleLabel,
  inferDisplayRole,
  type DisplayRole,
} from "../domain/displayRole";
import { normalizeInternalUploadUrl, normalizePublicWebsiteUrl } from "../domain/urlSafety";
import { getUserCapabilities, isSuperadmin } from "./capabilities";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type UserListItem = User & {
  display_role: DisplayRole;
  role_label: string;
};

// In-memory store for JSON mode (when DATABASE_URL is not set)
const memoryUsers: Map<string, User> = new Map();
let memoryUserIdCounter = 1;

export type User = {
  id: string;
  casdoor_id: string | null;
  name: string;
  avatar_url: string;
  avatar_source: "casdoor" | "upload" | "default";
  /** Latest avatar URL reported by OAuth/IdP (Casdoor); refreshed on each login. */
  external_avatar_url: string;
  /** Last successful site upload URL; used when switching back to custom avatar. */
  upload_avatar_url: string;
  email: string | null;
  role: "user" | "dev" | "ops";
  stcn_user_id: string | null;
  stcn_username: string | null;
  hzzc_user_id: string | null;
  is_active: boolean;
  token_version: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeUserAvatarUrl(value: unknown): string {
  const internal = normalizeInternalUploadUrl(value);
  if (internal) return internal;
  return normalizePublicWebsiteUrl(value);
}

function normalizeAvatarUrlForSource(value: unknown, source: User["avatar_source"] | undefined): string {
  if (source === "upload") return normalizeInternalUploadUrl(value);
  return normalizeUserAvatarUrl(value);
}

function normalizeUserAvatarInput<T extends {
  avatar_url?: string;
  avatar_source?: User["avatar_source"];
  external_avatar_url?: string;
  upload_avatar_url?: string;
}>(input: T): T {
  const out = { ...input };
  const source = input.avatar_source;
  if (input.avatar_url !== undefined) out.avatar_url = normalizeAvatarUrlForSource(input.avatar_url, source);
  if (input.external_avatar_url !== undefined) out.external_avatar_url = normalizeUserAvatarUrl(input.external_avatar_url);
  if (input.upload_avatar_url !== undefined) out.upload_avatar_url = normalizeInternalUploadUrl(input.upload_avatar_url);
  return out;
}

function createMemoryUser(input: {
  casdoor_id?: string;
  name: string;
  avatar_url?: string;
  avatar_source?: "casdoor" | "upload" | "default";
  external_avatar_url?: string;
  upload_avatar_url?: string;
  email?: string;
  role?: "user" | "dev" | "ops";
  stcn_user_id?: string;
  stcn_username?: string;
  hzzc_user_id?: string;
}): User {
  const safeInput = normalizeUserAvatarInput(input);
  const now = new Date().toISOString();
  const user: User = {
    id: `mem-${memoryUserIdCounter++}`,
    casdoor_id: safeInput.casdoor_id ?? null,
    name: safeInput.name,
    avatar_url: safeInput.avatar_url ?? "",
    avatar_source: safeInput.avatar_source ?? "default",
    external_avatar_url: safeInput.external_avatar_url ?? "",
    upload_avatar_url: safeInput.upload_avatar_url ?? "",
    email: safeInput.email ?? null,
    role: safeInput.role ?? "user",
    stcn_user_id: safeInput.stcn_user_id ?? null,
    stcn_username: safeInput.stcn_username ?? null,
    hzzc_user_id: safeInput.hzzc_user_id ?? null,
    is_active: true,
    token_version: 0,
    last_login_at: now,
    created_at: now,
    updated_at: now,
  };
  memoryUsers.set(user.id, user);
  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  if (!dbEnabled) {
    return memoryUsers.get(id) ?? null;
  }
  const rows = await sql()<User[]>`
    select id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
    from users where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function findUserByCasdoorId(casdoorId: string): Promise<User | null> {
  if (!dbEnabled) {
    for (const user of memoryUsers.values()) {
      if (user.casdoor_id === casdoorId) return user;
    }
    return null;
  }
  const rows = await sql()<User[]>`
    select id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
    from users where casdoor_id = ${casdoorId} limit 1
  `;
  return rows[0] ?? null;
}

export async function findUserByName(name: string): Promise<User | null> {
  if (!dbEnabled) {
    for (const user of memoryUsers.values()) {
      if (user.name === name) return user;
    }
    return null;
  }
  const rows = await sql()<User[]>`
    select id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
    from users where name = ${name} limit 1
  `;
  return rows[0] ?? null;
}

export async function createUser(input: {
  casdoor_id?: string;
  name: string;
  avatar_url?: string;
  avatar_source?: "casdoor" | "upload" | "default";
  external_avatar_url?: string;
  upload_avatar_url?: string;
  email?: string;
  role?: "user" | "dev" | "ops";
  stcn_user_id?: string;
  stcn_username?: string;
  hzzc_user_id?: string;
}): Promise<User> {
  const safeInput = normalizeUserAvatarInput(input);
  if (!dbEnabled) {
    return createMemoryUser(safeInput);
  }
  const [row] = await sql()<User[]>`
    insert into users (casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id)
    values (${safeInput.casdoor_id ?? null}, ${safeInput.name}, ${safeInput.avatar_url ?? ""}, ${safeInput.avatar_source ?? "default"}, ${safeInput.external_avatar_url ?? ""}, ${safeInput.upload_avatar_url ?? ""}, ${safeInput.email ?? null}, ${safeInput.role ?? "user"}, ${safeInput.stcn_user_id ?? null}, ${safeInput.stcn_username ?? null}, ${safeInput.hzzc_user_id ?? null})
    returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  return row;
}

export async function updateUserLogin(id: string, updates?: Partial<Pick<User, "name" | "avatar_url" | "avatar_source" | "external_avatar_url" | "upload_avatar_url" | "email" | "stcn_user_id" | "stcn_username" | "hzzc_user_id">>): Promise<User | null> {
  const safeUpdates = updates ? normalizeUserAvatarInput(updates) : undefined;
  if (!dbEnabled) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    const now = new Date().toISOString();
    const updated = {
      ...user,
      last_login_at: now,
      updated_at: now,
      ...(safeUpdates?.name !== undefined && { name: safeUpdates.name }),
      ...(safeUpdates?.avatar_url !== undefined && { avatar_url: safeUpdates.avatar_url }),
      ...(safeUpdates?.avatar_source !== undefined && { avatar_source: safeUpdates.avatar_source }),
      ...(safeUpdates?.external_avatar_url !== undefined && { external_avatar_url: safeUpdates.external_avatar_url }),
      ...(safeUpdates?.upload_avatar_url !== undefined && { upload_avatar_url: safeUpdates.upload_avatar_url }),
      ...(safeUpdates?.email !== undefined && { email: safeUpdates.email }),
      ...(safeUpdates?.stcn_user_id !== undefined && { stcn_user_id: safeUpdates.stcn_user_id }),
      ...(safeUpdates?.stcn_username !== undefined && { stcn_username: safeUpdates.stcn_username }),
      ...(safeUpdates?.hzzc_user_id !== undefined && { hzzc_user_id: safeUpdates.hzzc_user_id }),
    };
    memoryUsers.set(id, updated);
    return updated;
  }

  const [row] = await sql()<User[]>`
    update users
    set last_login_at = now(),
        name = case when ${safeUpdates?.name !== undefined} then ${safeUpdates?.name ?? null} else name end,
        avatar_url = case when ${safeUpdates?.avatar_url !== undefined} then ${safeUpdates?.avatar_url ?? null} else avatar_url end,
        avatar_source = case when ${safeUpdates?.avatar_source !== undefined} then ${safeUpdates?.avatar_source ?? null} else avatar_source end,
        external_avatar_url = case when ${safeUpdates?.external_avatar_url !== undefined} then ${safeUpdates?.external_avatar_url ?? null} else external_avatar_url end,
        upload_avatar_url = case when ${safeUpdates?.upload_avatar_url !== undefined} then ${safeUpdates?.upload_avatar_url ?? null} else upload_avatar_url end,
        email = case when ${safeUpdates?.email !== undefined} then ${safeUpdates?.email ?? null} else email end,
        stcn_user_id = case when ${safeUpdates?.stcn_user_id !== undefined} then ${safeUpdates?.stcn_user_id ?? null} else stcn_user_id end,
        stcn_username = case when ${safeUpdates?.stcn_username !== undefined} then ${safeUpdates?.stcn_username ?? null} else stcn_username end,
        hzzc_user_id = case when ${safeUpdates?.hzzc_user_id !== undefined} then ${safeUpdates?.hzzc_user_id ?? null} else hzzc_user_id end
    where id = ${id}
    returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  return row ?? null;
}

// The seed superadmin username is preserved as ops permanently to avoid lock-out
// after fresh installs. Other ops users can still be demoted/promoted freely.
const SEED_SUPERADMIN_USERNAME = (process.env.SUPERADMIN_INITIAL_USERNAME ?? "lincube").trim();

export async function setUserRole(id: string, role: "user" | "dev" | "ops"): Promise<User | null> {
  if (!dbEnabled) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    if (user.name === SEED_SUPERADMIN_USERNAME && role !== "ops") {
      throw new Error("SUPERADMIN_ROLE_IMMUTABLE");
    }
    const updated = { ...user, role, updated_at: new Date().toISOString() };
    memoryUsers.set(id, updated);
    return updated;
  }
  const existing = await findUserById(id);
  if (existing?.name === SEED_SUPERADMIN_USERNAME && role !== "ops") {
    throw new Error("SUPERADMIN_ROLE_IMMUTABLE");
  }
  const [row] = await sql()<User[]>`
    update users set role = ${role}
    where id = ${id}
    returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  return row ?? null;
}

export async function setUserActive(id: string, isActive: boolean): Promise<User | null> {
  if (!dbEnabled) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    const updated = { ...user, is_active: isActive, updated_at: new Date().toISOString() };
    memoryUsers.set(id, updated);
    return updated;
  }
  const [row] = await sql()<User[]>`
    update users set is_active = ${isActive}
    where id = ${id}
    returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  return row ?? null;
}

async function enrichUsersWithDisplayRole(items: User[]): Promise<UserListItem[]> {
  if (items.length === 0) return [];
  if (!dbEnabled) {
    return items.map((u) => {
      const display_role = inferDisplayRole([], isSuperadmin(u.name) ? u.name : undefined);
      return { ...u, display_role, role_label: displayRoleLabel(display_role) };
    });
  }

  const ids = items.map((u) => u.id);
  const capRows = await sql()<Array<{ user_id: string; capability_id: string }>>`
    select user_id, capability_id from user_capabilities where user_id = any(${ids}::uuid[])
  `;

  const capsByUser = new Map<string, string[]>();
  for (const row of capRows) {
    const list = capsByUser.get(row.user_id) ?? [];
    list.push(row.capability_id);
    capsByUser.set(row.user_id, list);
  }

  return items.map((u) => {
    const caps = capsByUser.get(u.id) ?? [];
    const display_role = inferDisplayRole(caps, u.name);
    return { ...u, display_role, role_label: displayRoleLabel(display_role) };
  });
}

export async function listUsers(params: { q?: string; role?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!dbEnabled) {
    let items = Array.from(memoryUsers.values());
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.stcn_user_id?.toLowerCase().includes(q) ?? false)
      );
    }
    const enriched = await enrichUsersWithDisplayRole(items);
    const filtered = params.role
      ? enriched.filter((u) => displayRoleMatchesFilter(u.display_role, params.role ?? ""))
      : enriched;
    const total = filtered.length;
    const pageItems = filtered.slice(offset, offset + pageSize);
    return { items: pageItems, page, pageSize, total };
  }

  const db = sql();
  const q = params.q?.trim();
  const qFilter = q ? db`and (name ilike ${`%${q}%`} or email ilike ${`%${q}%`} or stcn_user_id ilike ${`%${q}%`})` : db``;

  const items = params.role
    ? await db<User[]>`
        select id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
        from users
        where true ${qFilter}
        order by created_at desc
      `
    : await db<User[]>`
        select id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
        from users
        where true ${qFilter}
        order by created_at desc
        limit ${pageSize} offset ${offset}
      `;
  const enrichedItems = await enrichUsersWithDisplayRole(items);
  if (params.role) {
    const filtered = enrichedItems.filter((u) => displayRoleMatchesFilter(u.display_role, params.role ?? ""));
    return { items: filtered.slice(offset, offset + pageSize), page, pageSize, total: filtered.length };
  }

  const [{ count }] = await db<Array<{ count: string }>>`
    select count(*)::text as count from users where true ${qFilter}
  `;

  return { items: enrichedItems, page, pageSize, total: Number(count) };
}

export async function bumpUserTokenVersion(id: string): Promise<void> {
  if (!dbEnabled) {
    const user = memoryUsers.get(id);
    if (!user) return;
    user.token_version += 1;
    memoryUsers.set(id, user);
    return;
  }
  await sql()`update users set token_version = token_version + 1 where id = ${id}`;
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!dbEnabled) {
    return memoryUsers.delete(id);
  }
  const rows = await sql()<Array<{ id: string }>>`
    delete from users where id = ${id}
    returning id
  `;
  return rows.length > 0;
}

/** Apply persisted avatar preference (alliance/IdP URL vs last uploaded URL). */
export async function updateUserAvatarPreference(userId: string, source: "casdoor" | "upload"): Promise<User> {
  const row = await findUserById(userId);
  if (!row) throw new Error("USER_NOT_FOUND");
  const ext = (row.external_avatar_url ?? "").trim();
  const upl = (row.upload_avatar_url ?? "").trim();
  if (source === "casdoor") {
    if (!ext) throw new Error("MISSING_EXTERNAL_AVATAR");
    const updated = await updateUserLogin(userId, { avatar_url: ext, avatar_source: "casdoor" });
    if (!updated) throw new Error("USER_NOT_FOUND");
    return updated;
  }
  if (!upl) throw new Error("MISSING_UPLOAD_AVATAR");
  const updated = await updateUserLogin(userId, { avatar_url: upl, avatar_source: "upload" });
  if (!updated) throw new Error("USER_NOT_FOUND");
  return updated;
}

export type PublicUserProfile = {
  name: string;
  avatar_url: string;
  role_label: string;
  project_count: number;
  organization_count: number;
  joined_at: string;
};

export async function getUserPublicProfile(name: string): Promise<PublicUserProfile | null> {
  if (!dbEnabled) {
    const user = Array.from(memoryUsers.values()).find(u => u.name === name);
    if (!user) return null;
    return {
      name: user.name,
      avatar_url: user.avatar_url,
      role_label: user.role === "ops" ? "运维" : user.role === "dev" ? "开发者" : "用户",
      project_count: 0,
      organization_count: 0,
      joined_at: user.created_at,
    };
  }
  const [userRow] = await sql()<Array<{ id: string; name: string; avatar_url: string; created_at: string }>>`
    select id, name, avatar_url, created_at from users where name = ${name} limit 1
  `;
  if (!userRow) return null;

  const [{ count: projectCount }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from project_members where user_id = ${userRow.id}
  `;
  const [{ count: orgCount }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from organization_members om join organizations o on o.id = om.org_id where om.user_id = ${userRow.id} and o.status = 'approved'
  `;

  const caps = await getUserCapabilities(userRow.id);
  const displayRole = inferDisplayRole(caps, userRow.name);

  return {
    name: userRow.name,
    avatar_url: userRow.avatar_url,
    role_label: displayRoleLabel(displayRole),
    project_count: Number(projectCount),
    organization_count: Number(orgCount),
    joined_at: userRow.created_at,
  };
}

export type PublicUserComment = {
  id: string;
  project_name: string;
  body: string;
  created_at: string;
};

export async function getUserPublicComments(name: string, page: number, pageSize: number): Promise<{ items: PublicUserComment[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) {
    return { items: [], page, pageSize, total: 0 };
  }
  const offset = (page - 1) * pageSize;
  const rows = await sql()<PublicUserComment[]>`
    select fe.id, fe.project_name, fe.body, fe.created_at
    from feedback_entries fe
    left join comment_moderation cm on cm.feedback_entry_id = fe.id
    where fe.actor_username = ${name} and fe.kind = 'comment'
      and (cm.id is null or cm.status = 'approved')
    order by fe.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count
    from feedback_entries fe
    left join comment_moderation cm on cm.feedback_entry_id = fe.id
    where fe.actor_username = ${name} and fe.kind = 'comment'
      and (cm.id is null or cm.status = 'approved')
  `;
  return { items: rows, page, pageSize, total: Number(count) };
}

export type PublicUserProject = {
  project_name: string;
  display_name: string;
  icon_url: string;
  description: string;
  role: string;
};

export async function getUserPublicProjects(name: string): Promise<PublicUserProject[]> {
  if (!dbEnabled) return [];
  const [userRow] = await sql()<Array<{ id: string }>>`select id from users where name = ${name} limit 1`;
  if (!userRow) return [];
  const { getUserProjects } = await import("./projectMembers");
  const memberships = await getUserProjects(userRow.id);
  if (memberships.length === 0) return [];
  const projectIds = memberships.map(m => m.project_id);
  const projects = await sql()<Array<{ id: string; project_name: string; display_name: string; icon_url: string; description: string }>>`
    select id, name as project_name, name as display_name, coalesce(nullif(icon, ''), '') as icon_url, description
    from projects
    where id = any(${projectIds}::uuid[])
  `;
  const projectMap = new Map(projects.map(p => [p.id, p]));
  return memberships
    .map(m => {
      const p = projectMap.get(m.project_id);
      if (!p) return null;
      return {
        project_name: p.project_name,
        display_name: p.display_name,
        icon_url: p.icon_url,
        description: p.description,
        role: m.role,
      };
    })
    .filter(Boolean) as PublicUserProject[];
}

export type PublicUserOrganization = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string;
  description: string;
  role: string;
};

export async function getUserPublicOrganizations(name: string): Promise<PublicUserOrganization[]> {
  if (!dbEnabled) return [];
  const [userRow] = await sql()<Array<{ id: string }>>`select id from users where name = ${name} limit 1`;
  if (!userRow) return [];
  const { getUserOrganizations } = await import("./organizations");
  const orgs = await getUserOrganizations(userRow.id);
  return orgs.map(o => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    avatar_url: o.avatar_url,
    description: o.description,
    role: o.member_role,
  }));
}

export async function renameUser(input: {
  userId: string;
  newName: string;
  changedBy?: string;
  source?: "self" | "admin";
}): Promise<User> {
  const { userId, newName, changedBy, source = "self" } = input;
  const nameRegex = /^[\p{L}\p{N}_-]{2,30}$/u;
  if (!nameRegex.test(newName)) {
    throw new Error("INVALID_NAME_FORMAT");
  }
  if (!dbEnabled) {
    const user = memoryUsers.get(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const oldName = user.name;
    for (const u of memoryUsers.values()) {
      if (u.id !== userId && u.name.toLowerCase() === newName.toLowerCase()) {
        throw new Error("NAME_ALREADY_TAKEN");
      }
    }
    if (source === "self") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentChanges = Array.from(memoryUsers.values()).length;
      if (recentChanges > 0) {
        // simplified check for memory mode
      }
    }
    user.name = newName;
    user.token_version += 1;
    user.updated_at = new Date().toISOString();
    memoryUsers.set(userId, user);
    return user;
  }

  const [existing] = await sql()<Array<{ id: string }>>`select id from users where lower(name) = lower(${newName}) and id != ${userId} limit 1`;
  if (existing) throw new Error("NAME_ALREADY_TAKEN");

  if (source === "self") {
    const [recent] = await sql()<Array<{ created_at: string }>>`
      select created_at from user_name_changes
      where user_id = ${userId} and source = 'self'
      order by created_at desc limit 1
    `;
    if (recent) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (new Date(recent.created_at) > thirtyDaysAgo) {
        throw new Error("RENAME_COOLDOWN");
      }
    }
  }

  const [oldUser] = await sql()<Array<{ name: string }>>`select name from users where id = ${userId} limit 1`;
  if (!oldUser) throw new Error("USER_NOT_FOUND");
  const oldName = oldUser.name;

  await sql()`update feedback_entries set actor_username = ${newName} where actor_username = ${oldName}`;
  await sql()`update feedback_replies set actor_username = ${newName} where actor_username = ${oldName}`;

  await sql()`
    insert into user_name_changes (user_id, old_name, new_name, changed_by, source)
    values (${userId}, ${oldName}, ${newName}, ${changedBy ?? null}, ${source})
  `;

  await sql()`update users set name = ${newName}, updated_at = now() where id = ${userId}`;

  await sql()`update users set token_version = token_version + 1 where id = ${userId}`;

  const fresh = await findUserById(userId);
  if (!fresh) throw new Error("USER_NOT_FOUND");
  return fresh;
}

/** Issue a JWT matching the user's current token_version (e.g. after rename). */
export async function issueUserAuthToken(userId: string): Promise<{ token: string; user: User } | null> {
  const row = await findUserById(userId);
  if (!row || !row.is_active) return null;
  const { signJwt } = await import("../utils/jwt");
  const token = signJwt({
    sub: row.id,
    name: row.name,
    role: row.role,
    tv: row.token_version ?? 0,
  });
  return { token, user: row };
}
