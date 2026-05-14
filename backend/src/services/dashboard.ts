import { sql } from "../db/client";
import { userHasCapability, isSuperadmin } from "./capabilities";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type DashboardData = {
  projects?: { total: number; newThisWeek: number };
  pendingSubmissions?: number;
  pendingModeration?: { comments: number; bugs: number };
  openFeedback?: number;
  users?: { total: number; newThisWeek: number };
  media?: { total: number; totalSize: number };
  stories?: number;
  recentActivity?: Array<{ action: string; entity_type: string; entity_id: string; actor: string; created_at: string }>;
};

export async function getDashboardData(userId: string, username: string): Promise<DashboardData> {
  if (!dbEnabled) return {};

  const data: DashboardData = {};
  const isSuper = isSuperadmin(username);

  async function hasCap(capId: string): Promise<boolean> {
    if (isSuper) return true;
    return userHasCapability(userId, username, capId);
  }

  if (await hasCap("project:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from projects`;
    const [{ new_this_week }] = await sql()<Array<{ new_this_week: string }>>`select count(*)::text as new_this_week from projects where created_at >= now() - interval '7 days'`;
    data.projects = { total: Number(total), newThisWeek: Number(new_this_week) };
  }

  if (await hasCap("submission:read")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from submissions where status = 'pending'`;
    data.pendingSubmissions = Number(count);
  }

  if (await hasCap("moderation:read")) {
    const [{ comments }] = await sql()<Array<{ comments: string }>>`select count(*)::text as comments from feedback where kind = 'comment' and status = 'pending'`;
    const [{ bugs }] = await sql()<Array<{ bugs: string }>>`select count(*)::text as bugs from feedback where kind = 'bug' and status = 'pending'`;
    data.pendingModeration = { comments: Number(comments), bugs: Number(bugs) };
  }

  if (await hasCap("feedback:manage")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from feedback where status = 'open'`;
    data.openFeedback = Number(count);
  }

  if (await hasCap("user:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from users`;
    const [{ new_this_week }] = await sql()<Array<{ new_this_week: string }>>`select count(*)::text as new_this_week from users where created_at >= now() - interval '7 days'`;
    data.users = { total: Number(total), newThisWeek: Number(new_this_week) };
  }

  if (await hasCap("media:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from media_assets where status = 'active'`;
    const [{ total_size }] = await sql()<Array<{ total_size: string }>>`select coalesce(sum(size), 0)::text as total_size from media_assets where status = 'active'`;
    data.media = { total: Number(total), totalSize: Number(total_size) };
  }

  if (await hasCap("story:manage")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from stories`;
    data.stories = Number(count);
  }

  if (await hasCap("audit:read")) {
    const rows = await sql()<Array<{ action: string; entity_type: string; entity_id: string; actor: string; created_at: string }>>`
      select action, entity_type, entity_id, actor, created_at
      from audit_logs
      order by created_at desc
      limit 10
    `;
    data.recentActivity = rows;
  }

  return data;
}
