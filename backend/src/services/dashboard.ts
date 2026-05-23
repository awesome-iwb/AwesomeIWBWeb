import { sql } from "../db/client";
import { userHasCapability, isSuperadmin } from "./capabilities";
import { getAnalyticsSummary } from "./analytics";
import fs from "fs";
import path from "path";

const dbEnabled = Boolean(process.env.DATABASE_URL);
const STORIES_DIR = path.join(process.cwd(), "stories");

export type DashboardData = {
  projects?: { total: number; newThisWeek: number; recent: Array<{ slug: string; name: string; description: string; icon: string; banner: string; stars: number; language: string; developer: string; created_at: string }> };
  pendingSubmissions?: { count: number; recent: Array<{ id: string; status: string; payload: any; created_at: string }> };
  pendingModeration?: { comments: number; bugs: number; recentComments: Array<{ id: string; project_name: string; body: string; actor_username: string; created_at: string }>; recentBugs: Array<{ id: string; project_name: string; title: string; actor_username: string; created_at: string }> };
  openFeedback?: { count: number; recent: Array<{ id: string; project_name: string; kind: string; title: string; body: string; actor_username: string; created_at: string }> };
  users?: { total: number; newThisWeek: number; recent: Array<{ id: string; name: string; avatar_url: string; role: string; created_at: string }> };
  media?: { total: number; totalSize: number; recent: Array<{ id: string; url: string; mime: string; size: number; uploader_id: string; created_at: string }> };
  stories?: { total: number; recent: Array<{ id: string; title: string; cover: string; author: string; created_at: string }> };
  recentActivity?: Array<{ action: string; entity_type: string; entity_id: string; actor: string; created_at: string }>;
  analytics?: {
    pvToday: number;
    pvThisWeek: number;
    topProject: { slug: string; clicks: number } | null;
    topSearchQuery: string | null;
  };
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
    const recent = await sql()<Array<{ slug: string; name: string; description: string; icon: string; banner: string; stars: number; language: string; developer: string; created_at: string }>>`
      select slug, name, description, icon, banner, stars, language, developer, created_at
      from projects order by created_at desc limit 5
    `;
    data.projects = { total: Number(total), newThisWeek: Number(new_this_week), recent };
  }

  if (await hasCap("submission:read")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from project_submissions where status = 'pending'`;
    const recent = await sql()<Array<{ id: string; status: string; payload: any; created_at: string }>>`
      select id, status, payload, created_at from project_submissions order by created_at desc limit 5
    `;
    data.pendingSubmissions = { count: Number(count), recent };
  }

  if (await hasCap("moderation:read")) {
    const [{ comments }] = await sql()<Array<{ comments: string }>>`select count(*)::text as comments from comment_moderation where status = 'pending'`;
    const [{ bugs }] = await sql()<Array<{ bugs: string }>>`select count(*)::text as bugs from bug_moderation where status = 'pending'`;
    const recentComments = await sql()<Array<{ id: string; project_name: string; body: string; actor_username: string; created_at: string }>>`
      select id, project_name, body, actor_username, created_at from comment_moderation order by created_at desc limit 3
    `;
    const recentBugs = await sql()<Array<{ id: string; project_name: string; title: string; actor_username: string; created_at: string }>>`
      select id, project_name, title, actor_username, created_at from bug_moderation order by created_at desc limit 3
    `;
    data.pendingModeration = { comments: Number(comments), bugs: Number(bugs), recentComments, recentBugs };
  }

  if (await hasCap("feedback:manage")) {
    const [{ count }] = await sql()<Array<{ count: string }>>`select count(*)::text as count from feedback_entries where status = 'open'`;
    const recent = await sql()<Array<{ id: string; project_name: string; kind: string; title: string; body: string; actor_username: string; created_at: string }>>`
      select id, project_name, kind, title, body, actor_username, created_at from feedback_entries order by created_at desc limit 5
    `;
    data.openFeedback = { count: Number(count), recent };
  }

  if (await hasCap("user:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from users`;
    const [{ new_this_week }] = await sql()<Array<{ new_this_week: string }>>`select count(*)::text as new_this_week from users where created_at >= now() - interval '7 days'`;
    const recent = await sql()<Array<{ id: string; name: string; avatar_url: string; role: string; created_at: string }>>`
      select id, name, avatar_url, role, created_at from users order by created_at desc limit 5
    `;
    data.users = { total: Number(total), newThisWeek: Number(new_this_week), recent };
  }

  if (await hasCap("media:read")) {
    const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from media_assets where status = 'active'`;
    const [{ total_size }] = await sql()<Array<{ total_size: string }>>`select coalesce(sum(size), 0)::text as total_size from media_assets where status = 'active'`;
    const recent = await sql()<Array<{ id: string; url: string; mime: string; size: number; uploader_id: string; created_at: string }>>`
      select id, url, mime, size, uploader_id, created_at from media_assets where status = 'active' order by created_at desc limit 6
    `;
    data.media = { total: Number(total), totalSize: Number(total_size), recent };
  }

  if (await hasCap("story:manage")) {
    try {
      const rows = await sql()<Array<{ id: string; slug: string; title: string; cover_image: string; updated_at: string }>>`
        select id, slug, title, cover_image, updated_at::text as updated_at
        from articles
        order by updated_at desc
        limit 20
      `;
      const storyList = rows.map((r) => ({
        id: r.slug || r.id,
        title: r.title,
        cover: r.cover_image,
        author: "",
        created_at: r.updated_at,
      }));
      const [{ total }] = await sql()<Array<{ total: string }>>`select count(*)::text as total from articles`;
      data.stories = { total: Number(total), recent: storyList.slice(0, 5) };
    } catch {
      data.stories = { total: 0, recent: [] };
    }
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

  if (await hasCap("analytics:read")) {
    try {
      data.analytics = await getAnalyticsSummary();
    } catch {}
  }

  return data;
}
