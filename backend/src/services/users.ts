import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

// In-memory store for JSON mode (when DATABASE_URL is not set)
const memoryUsers: Map<string, User> = new Map();
let memoryUserIdCounter = 1;

export type User = {
  id: string;
  casdoor_id: string | null;
  name: string;
  avatar_url: string;
  avatar_source: "casdoor" | "upload" | "default";
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
    select id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
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
    select id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
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
    select id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
    from users where name = ${name} limit 1
  `;
  return rows[0] ?? null;
}

export async function createUser(input: {
  casdoor_id?: string;
  name: string;
  avatar_url?: string;
  avatar_source?: "casdoor" | "upload" | "default";
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
    insert into users (casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id)
    values (${input.casdoor_id ?? null}, ${input.name}, ${input.avatar_url ?? ""}, ${input.avatar_source ?? "default"}, ${input.email ?? null}, ${input.role ?? "user"}, ${input.stcn_user_id ?? null}, ${input.stcn_username ?? null}, ${input.hzzc_user_id ?? null})
    returning id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
  `;
  return row;
}

export async function updateUserLogin(id: string, updates?: Partial<Pick<User, "name" | "avatar_url" | "avatar_source" | "email" | "stcn_user_id" | "stcn_username" | "hzzc_user_id">>): Promise<User | null> {
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
    returning id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
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
    `update users set role = $1 where id = $2 returning id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at`,
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
    `update users set is_active = $1 where id = $2 returning id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at`,
    [isActive, id]
  );
  return (rows as User[])[0] ?? null;
}

export async function listUsers(params: { q?: string; role?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!dbEnabled) {
    let items = Array.from(memoryUsers.values());
    if (params.role) {
      items = items.filter(u => u.role === params.role);
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.stcn_user_id?.toLowerCase().includes(q) ?? false)
      );
    }
    const total = items.length;
    items = items.slice(offset, offset + pageSize);
    return { items, page, pageSize, total };
  }

  const whereParts: string[] = [];
  const queryParams: any[] = [];

  if (params.role) {
    queryParams.push(params.role);
    whereParts.push(`role = $${queryParams.length}`);
  }
  if (params.q) {
    queryParams.push(`%${params.q}%`);
    whereParts.push(`(name ilike $${queryParams.length} or email ilike $${queryParams.length} or stcn_user_id ilike $${queryParams.length})`);
  }

  const whereClause = whereParts.length ? `where ${whereParts.join(" and ")}` : "";

  const countQuery = `select count(*)::text as count from users ${whereClause}`;
  const itemsQuery = `
    select id, casdoor_id, name, avatar_url, avatar_source, email, role, stcn_user_id, stcn_username, hzzc_user_id, is_active, token_version, last_login_at, created_at, updated_at
    from users
    ${whereClause}
    order by created_at desc
    limit ${pageSize} offset ${offset}
  `;

  const items = await sql().unsafe(itemsQuery, queryParams) as User[];
  const [{ count }] = await sql().unsafe(countQuery, queryParams) as Array<{ count: string }>;

  return { items, page, pageSize, total: Number(count) };
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
