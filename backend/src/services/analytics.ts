import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  if (ip.includes(":")) {
    const segs = ip.split(":");
    if (segs.length >= 3) return `${segs[0]}:${segs[1]}:${segs[2]}:x`;
  }
  return ip;
}

function truncateUa(ua: string): string {
  return ua.slice(0, 200);
}

export async function recordPageView(input: {
  path: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
}) {
  if (!dbEnabled) return;
  try {
    await sql()`
      insert into page_views (path, referrer, user_agent, ip)
      values (${input.path}, ${input.referrer ?? ""}, ${truncateUa(input.userAgent ?? "")}, ${maskIp(input.ip ?? "")})
    `;
  } catch {}
}

export async function recordClickEvent(input: {
  projectSlug: string;
  eventType: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
}) {
  if (!dbEnabled) return;
  try {
    const type = input.eventType === "download" || input.eventType === "github" ? input.eventType : "click";
    await sql()`
      insert into click_events (project_slug, event_type, referrer, user_agent, ip)
      values (${input.projectSlug}, ${type}, ${input.referrer ?? ""}, ${truncateUa(input.userAgent ?? "")}, ${maskIp(input.ip ?? "")})
    `;
  } catch {}
}

export async function recordSearchQuery(input: {
  query: string;
  resultsCount: number;
  userAgent?: string;
  ip?: string;
}) {
  if (!dbEnabled) return;
  try {
    await sql()`
      insert into search_queries (query, results_count, user_agent, ip)
      values (${input.query}, ${input.resultsCount}, ${truncateUa(input.userAgent ?? "")}, ${maskIp(input.ip ?? "")})
    `;
  } catch {}
}

export type AnalyticsOverview = {
  pv: { total: number; today: number; thisWeek: number };
  uv: { total: number; today: number; thisWeek: number };
  clicks: { total: number; today: number };
  searches: { total: number; today: number };
  dailyPvTrend: Array<{ date: string; pv: number; uv: number }>;
  hourlyDistribution: Array<{ hour: number; pv: number; uv: number }>;
  weeklyDistribution: Array<{ weekday: number; pv: number }>;
  topPages: Array<{ path: string; displayName: string; count: number }>;
  topProjects: Array<{ slug: string; name: string; clicks: number; downloads: number }>;
  topSearches: Array<{ query: string; count: number; avgResults: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
};

export function clampAnalyticsDays(days: number): number {
  return Math.min(90, Math.max(1, Math.floor(days) || 7));
}

export async function getAnalyticsOverview(days: number): Promise<AnalyticsOverview> {
  const rangeDays = clampAnalyticsDays(days);

  const [{ pv_total }] = await sql()<Array<{ pv_total: string }>>`
    select count(*)::text as pv_total from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;
  const [{ pv_today }] = await sql()<Array<{ pv_today: string }>>`
    select count(*)::text as pv_today from page_views
    where created_at >= date_trunc('day', now())
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;
  const [{ pv_week }] = await sql()<Array<{ pv_week: string }>>`
    select count(*)::text as pv_week from page_views
    where created_at >= date_trunc('week', now())
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;

  const [{ uv_total }] = await sql()<Array<{ uv_total: string }>>`
    select count(distinct ip)::text as uv_total from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;
  const [{ uv_today }] = await sql()<Array<{ uv_today: string }>>`
    select count(distinct ip)::text as uv_today from page_views
    where created_at >= date_trunc('day', now())
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;
  const [{ uv_week }] = await sql()<Array<{ uv_week: string }>>`
    select count(distinct ip)::text as uv_week from page_views
    where created_at >= date_trunc('week', now())
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;

  const [{ click_total }] = await sql()<Array<{ click_total: string }>>`
    select count(*)::text as click_total from click_events
    where created_at >= now() - ${rangeDays} * interval '1 day'
  `;
  const [{ click_today }] = await sql()<Array<{ click_today: string }>>`
    select count(*)::text as click_today from click_events
    where created_at >= date_trunc('day', now())
  `;

  const [{ search_total }] = await sql()<Array<{ search_total: string }>>`
    select count(*)::text as search_total from search_queries
    where created_at >= now() - ${rangeDays} * interval '1 day'
  `;
  const [{ search_today }] = await sql()<Array<{ search_today: string }>>`
    select count(*)::text as search_today from search_queries
    where created_at >= date_trunc('day', now())
  `;

  const dailyPvTrend = await sql()<Array<{ date: string; pv: number; uv: number }>>`
    select date_trunc('day', created_at)::date::text as date,
           count(*) as pv,
           count(distinct ip) as uv
    from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
    group by date_trunc('day', created_at)
    order by date asc
  `;

  const hourlyDistribution = await sql()<Array<{ hour: number; pv: number; uv: number }>>`
    select extract(hour from created_at)::int as hour,
           count(*) as pv,
           count(distinct ip) as uv
    from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
    group by extract(hour from created_at)
    order by hour asc
  `;

  const weeklyDistribution = await sql()<Array<{ weekday: number; pv: number }>>`
    select extract(isodow from created_at)::int as weekday,
           count(*) as pv
    from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
    group by extract(isodow from created_at)
    order by weekday asc
  `;

  const topPages = await sql()<Array<{ path: string; display_name: string; count: number }>>`
    select
      path,
      case
        when path = '/' then '首页'
        when path = '/categories' then '分类浏览'
        when path = '/today' then '今日推荐'
        when path = '/compare' then '项目对比'
        when path = '/submit' then '提交项目'
        when path = '/me' then '个人中心'
        when path like '/project/%' then
          initcap(replace(substring(path from '/project/(.*)'), '-', ' ')) || ' · 项目详情'
        else path
      end as display_name,
      count(*) as count
    from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
    group by path, display_name
    order by count desc
    limit 20
  `;

  const topProjectsRaw = await sql()<Array<{ project_slug: string; event_type: string; count: string }>>`
    select project_slug, event_type, count(*)::text as count
    from click_events
    where created_at >= now() - ${rangeDays} * interval '1 day'
    group by project_slug, event_type
    order by count desc
    limit 30
  `;
  const projectSlugs = [...new Set(topProjectsRaw.map(r => r.project_slug))];
  const projectNames = new Map<string, string>();
  if (projectSlugs.length > 0) {
    try {
      const rows = await sql()<Array<{ slug: string; name: string }>>`
        select slug, name from projects where slug = any(${projectSlugs})
      `;
      for (const r of rows) projectNames.set(r.slug, r.name);
    } catch {}
  }
  const projectMap = new Map<string, { slug: string; name: string; clicks: number; downloads: number }>();
  for (const r of topProjectsRaw) {
    let entry = projectMap.get(r.project_slug);
    if (!entry) {
      entry = { slug: r.project_slug, name: projectNames.get(r.project_slug) || r.project_slug, clicks: 0, downloads: 0 };
      projectMap.set(r.project_slug, entry);
    }
    if (r.event_type === "download") entry.downloads += Number(r.count);
    else entry.clicks += Number(r.count);
  }
  const topProjects = Array.from(projectMap.values())
    .sort((a, b) => (b.clicks + b.downloads) - (a.clicks + a.downloads))
    .slice(0, 10);

  const topSearches = await sql()<Array<{ query: string; count: number; avg_results: number }>>`
    select query, count(*) as count, avg(results_count)::real as avg_results
    from search_queries
    where created_at >= now() - ${rangeDays} * interval '1 day'
    group by query
    order by count desc
    limit 20
  `;

  const categoryDistribution = await sql()<Array<{ category: string; count: number }>>`
    select
      case
        when path like '/project/%' then '项目详情'
        when path = '/' then '首页'
        when path = '/categories' then '分类浏览'
        when path = '/today' then '今日推荐'
        when path = '/compare' then '项目对比'
        when path = '/submit' then '提交项目'
        when path = '/me' then '个人中心'
        else '其他'
      end as category,
      count(*) as count
    from page_views
    where created_at >= now() - ${rangeDays} * interval '1 day'
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
    group by category
    order by count desc
  `;

  return {
    pv: { total: Number(pv_total), today: Number(pv_today), thisWeek: Number(pv_week) },
    uv: { total: Number(uv_total), today: Number(uv_today), thisWeek: Number(uv_week) },
    clicks: { total: Number(click_total), today: Number(click_today) },
    searches: { total: Number(search_total), today: Number(search_today) },
    dailyPvTrend,
    hourlyDistribution,
    weeklyDistribution,
    topPages: topPages.map(p => ({ path: p.path, displayName: p.display_name, count: Number(p.count) })),
    topProjects,
    topSearches: topSearches.map(s => ({ query: s.query, count: Number(s.count), avgResults: Number(s.avg_results) })),
    categoryDistribution,
  };
}

export async function getAnalyticsSummary(): Promise<{
  pvToday: number;
  pvThisWeek: number;
  topProject: { slug: string; name: string; clicks: number } | null;
  topSearchQuery: string | null;
}> {
  if (!dbEnabled) {
    return { pvToday: 0, pvThisWeek: 0, topProject: null, topSearchQuery: null };
  }

  const [{ pv_today }] = await sql()<Array<{ pv_today: string }>>`
    select count(*)::text as pv_today from page_views
    where created_at >= date_trunc('day', now())
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;
  const [{ pv_week }] = await sql()<Array<{ pv_week: string }>>`
    select count(*)::text as pv_week from page_views
    where created_at >= date_trunc('week', now())
      and path not like '/admin%' and path not like '/dev%' and path not like '/api%'
  `;

  const topClick = await sql()<Array<{ project_slug: string; cnt: string }>>`
    select project_slug, count(*)::text as cnt
    from click_events
    where created_at >= now() - interval '7 days'
    group by project_slug
    order by cnt desc
    limit 1
  `;

  let topProject: { slug: string; name: string; clicks: number } | null = null;
  if (topClick[0]) {
    let name = topClick[0].project_slug;
    try {
      const rows = await sql()<Array<{ name: string }>>`
        select name from projects where slug = ${topClick[0].project_slug}
      `;
      if (rows[0]) name = rows[0].name;
    } catch {}
    topProject = { slug: topClick[0].project_slug, name, clicks: Number(topClick[0].cnt) };
  }

  const topSearch = await sql()<Array<{ query: string }>>`
    select query
    from search_queries
    where created_at >= now() - interval '7 days'
    group by query
    order by count(*) desc
    limit 1
  `;

  return {
    pvToday: Number(pv_today),
    pvThisWeek: Number(pv_week),
    topProject,
    topSearchQuery: topSearch[0]?.query ?? null,
  };
}
