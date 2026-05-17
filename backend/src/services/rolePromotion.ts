import { sql } from "../db/client";
import { setUserRole } from "./users";
import { hasAnyProjectMembership } from "./projectMembers";

const dbEnabled = Boolean(process.env.DATABASE_URL);

const DEV_CAPABILITY_IDS = [
  "dev_panel_access",
  "dev:project_edit", "dev:bug_manage", "dev:comment_manage",
  "dev:stats_view", "dev:project_admin", "dev:org_manage",
];

const USER_CAPABILITY_IDS = [
  "user:comment", "user:avatar", "user:feedback",
  "user:submit_project", "user:profile", "user:create_org",
];

export async function promoteToDev(userId: string): Promise<void> {
  if (!dbEnabled) return;
  const user = await sql()<Array<{ role: string }>>`select role from users where id = ${userId}`;
  if (!user.length) return;
  if (user[0].role === "dev" || user[0].role === "ops") return;
  await setUserRole(userId, "dev");
  const existingRows = await sql()<Array<{ capability_id: string }>>`
    select capability_id from user_capabilities where user_id = ${userId}
  `;
  const existing = new Set(existingRows.map(r => r.capability_id));
  const toAdd = [...USER_CAPABILITY_IDS, ...DEV_CAPABILITY_IDS].filter(id => !existing.has(id));
  if (toAdd.length > 0) {
    const values = toAdd.map(cid => `('${userId}', '${cid}')`).join(", ");
    await sql().unsafe(`insert into user_capabilities (user_id, capability_id) values ${values} on conflict do nothing`);
  }
  await sql()`insert into notifications (user_name, type, title, body) select name, 'role_promoted', '已升级为开发者', '您已获得开发者权限，可以访问开发者后台管理自己的项目。' from users where id = ${userId}`;
}

export async function demoteFromDev(userId: string): Promise<void> {
  if (!dbEnabled) return;
  const stillHasMembership = await hasAnyProjectMembership(userId);
  if (stillHasMembership) return;
  const user = await sql()<Array<{ role: string }>>`select role from users where id = ${userId}`;
  if (!user.length || user[0].role !== "dev") return;
  await setUserRole(userId, "user");
  for (const capId of DEV_CAPABILITY_IDS) {
    await sql()`delete from user_capabilities where user_id = ${userId} and capability_id = ${capId}`;
  }
  await sql()`insert into notifications (user_name, type, title, body) select name, 'role_demoted', '开发者权限已回收', '您已不再参与任何项目，开发者权限已自动回收。' from users where id = ${userId}`;
}
