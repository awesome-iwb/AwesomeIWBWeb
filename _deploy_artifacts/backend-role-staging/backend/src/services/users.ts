import { sql } from "../db/client";
import {
  buildDisplayRoleFilterSql,
  displayRoleLabel,
  inferDisplayRole,
  type DisplayRole,
} from "../domain/displayRole";
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
  const now = new Date().toISOString();
  const user: User = {
    id: `mem-${memoryUserIdCounter++}`,
    casdoor_id: input.casdoor_id ?? null,
    name: input.name,
    avatar_url: input.avatar_url ?? "",
    avatar_source: input.avatar_source ?? "default",
    external_avatar_url: input.external_avatar_url ?? "",
    upload_avatar_url: input.upload_avatar_url ?? "",
    email: input.email ?? null,
    role: input.role ?? "user",
    stcn_user_id: input.stcn_user_id ?? null,
    stcn_username: input.stcn_username ?? null,
    hzzc_user_id: input.hzzc_user_id ?? null,
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
  if (!dbEnabled) {
    return createMemoryUser(input);
  }
  const [row] = await sql()<User[]>`
    insert into users (casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id)
    values (${input.casdoor_id ?? null}, ${input.name}, ${input.avatar_url ?? ""}, ${input.avatar_source ?? "default"}, ${input.external_avatar_url ?? ""}, ${input.upload_avatar_url ?? ""}, ${input.email ?? null}, ${input.role ?? "user"}, ${input.stcn_user_id ?? null}, ${input.stcn_username ?? null}, ${input.hzzc_user_id ?? null})
    returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  return row;
}

export async function updateUserLogin(id: string, updates?: Partial<Pick<User, "name" | "avatar_url" | "avatar_source" | "external_avatar_url" | "upload_avatar_url" | "email" | "stcn_user_id" | "stcn_username" | "hzzc_user_id">>): Promise<User | null> {
  if (!dbEnabled) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    const now = new Date().toISOString();
    const updated = {
      ...user,
      last_login_at: now,
      updated_at: now,
      ...(updates?.name !== undefined && { name: updates.name }),
      ...(updates?.avatar_url !== undefined && { avatar_url: updates.avatar_url }),
      ...(updates?.avatar_source !== undefined && { avatar_source: updates.avatar_source }),
      ...(updates?.external_avatar_url !== undefined && { external_avatar_url: updates.external_avatar_url }),
      ...(updates?.upload_avatar_url !== undefined && { upload_avatar_url: updates.upload_avatar_url }),
      ...(updates?.email !== undefined && { email: updates.email }),
      ...(updates?.stcn_user_id !== undefined && { stcn_user_id: updates.stcn_user_id }),
      ...(updates?.stcn_username !== undefined && { stcn_username: updates.stcn_username }),
      ...(updates?.hzzc_user_id !== undefined && { hzzc_user_id: updates.hzzc_user_id }),
    };
    memoryUsers.set(id, updated);
    return updated;
  }

  const sets: string[] = ["last_login_at = now()"];
  const params: any[] = [];

  if (updates?.name !== undefined) {
    params.push(updates.name);
    sets.push(`name = $${params.length}`);
  }
  if (updates?.avatar_url !== undefined) {
    params.push(updates.avatar_url);
    sets.push(`avatar_url = $${params.length}`);
  }
  if (updates?.avatar_source !== undefined) {
    params.push(updates.avatar_source);
    sets.push(`avatar_source = $${params.length}`);
  }
  if (updates?.external_avatar_url !== undefined) {
    params.push(updates.external_avatar_url);
    sets.push(`external_avatar_url = $${params.length}`);
  }
  if (updates?.upload_avatar_url !== undefined) {
    params.push(updates.upload_avatar_url);
    sets.push(`upload_avatar_url = $${params.length}`);
  }
  if (updates?.email !== undefined) {
    params.push(updates.email);
    sets.push(`email = $${params.length}`);
  }
  if (updates?.stcn_user_id !== undefined) {
    params.push(updates.stcn_user_id);
    sets.push(`stcn_user_id = $${params.length}`);
  }
  if (updates?.stcn_username !== undefined) {
    params.push(updates.stcn_username);
    sets.push(`stcn_username = $${params.length}`);
  }
  if (updates?.hzzc_user_id !== undefined) {
    params.push(updates.hzzc_user_id);
    sets.push(`hzzc_user_id = $${params.length}`);
  }

  params.push(id);
  const query = `
    update users set ${sets.join(", ")}
    where id = $${params.length}
    returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  const rows = await sql().unsafe(query, params);
  return (rows as User[])[0] ?? null;
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
  const rows = await sql().unsafe(
    `update users set role = $1 where id = $2 returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at`,
    [role, id]
  );
  return (rows as User[])[0] ?? null;
}

export async function setUserActive(id: string, isActive: boolean): Promise<User | null> {
  if (!dbEnabled) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    const updated = { ...user, is_active: isActive, updated_at: new Date().toISOString() };
    memoryUsers.set(id, updated);
    return updated;
  }
  const rows = await sql().unsafe(
    `update users set is_active = $1 where id = $2 returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at`,
    [isActive, id]
  );
  return (rows as User[])[0] ?? null;
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
  const capRows = await sql().unsafe(
    `select user_id, capability_id from user_capabilities where user_id = any($1::uuid[])`,
    [ids],
  ) as Array<{ user_id: string; capability_id: string }>;

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
      ? enriched.filter((u) => u.display_role === params.role || (params.role === "ops" && u.display_role === "superadmin"))
      : enriched;
    const total = filtered.length;
    const pageItems = filtered.slice(offset, offset + pageSize);
    return { items: pageItems, page, pageSize, total };
  }

  const whereParts: string[] = [];
  const queryParams: any[] = [];

  const roleFilterSql = params.role ? buildDisplayRoleFilterSql(params.role) : null;
  if (roleFilterSql) {
    whereParts.push(`(${roleFilterSql})`);
  }
  if (params.q) {
    queryParams.push(`%${params.q}%`);
    whereParts.push(`(name ilike $${queryParams.length} or email ilike $${queryParams.length} or stcn_user_id ilike $${queryParams.length})`);
  }

  const whereClause = whereParts.length ? `where ${whereParts.join(" and ")}` : "";

  const countQuery = `select count(*)::text as count from users ${whereClause}`;
  const itemsQuery = `
    select id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
    from users
    ${whereClause}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const items = await sql().unsafe(itemsQuery, queryParams) as User[];
  const [{ count }] = await sql().unsafe(countQuery, queryParams) as Array<{ count: string }>;
  const enrichedItems = await enrichUsersWithDisplayRole(items);

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
  const result = await sql()`delete from users where id = ${id}`;
  return (result as any).rowCount > 0;
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
  const rows = await sql().unsafe(
    `select fe.id, fe.project_name, fe.body, fe.created_at
     from feedback_entries fe
     left join content_moderation_comments cm on cm.feedback_entry_id = fe.id
     where fe.actor_username = $1 and fe.kind = 'comment'
       and (cm.id is null or cm.status = 'approved')
     order by fe.created_at desc
     limit $2 offset $3`,
    [name, pageSize, offset]
  ) as PublicUserComment[];
  const [{ count }] = await sql().unsafe(
    `select count(*)::text as count
     from feedback_entries fe
     left join content_moderation_comments cm on cm.feedback_entry_id = fe.id
     where fe.actor_username = $1 and fe.kind = 'comment'
       and (cm.id is null or cm.status = 'approved')`,
    [name]
  ) as Array<{ count: string }>;
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
  const projectIds = memberships.map(m => `'${m.project_id}'`).join(",");
  const projects = await sql().unsafe(
    `select id, name as project_name, name as display_name, coalesce(nullif(icon, ''), '') as icon_url, description from projects where id in (${projectIds})`
  ) as Array<{ id: string; project_name: string; display_name: string; icon_url: string; description: string }>;
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

  await sql().unsafe(
    `update feedback_entries set actor_username = $1 where actor_username = $2`,
    [newName, oldName]
  );
  await sql().unsafe(
    `update feedback_replies set actor_username = $1 where actor_username = $2`,
    [newName, oldName]
  );

  await sql().unsafe(
    `insert into user_name_changes (user_id, old_name, new_name, changed_by, source) values ($1, $2, $3, $4, $5)`,
    [userId, oldName, newName, changedBy ?? null, source]
  );

  const [updated] = await sql().unsafe(
    `update users set name = $1, updated_at = now() where id = $2 returning id, casdoor_id, name, avatar_url, avatar_source, external_avatar_url, upload_avatar_url, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at`,
    [newName, userId]
  ) as User[];

  await sql()`update users set token_version = token_version + 1 where id = ${userId}`;

  return updated;
}
