import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export interface Page {
  id: string;
  path: string;
  title: string;
  description: string;
  group: string;
  icon: string;
  required_capability: string;
  is_visible: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export async function listPages(params?: { group?: string }): Promise<{ items: Page[] }> {
  if (!dbEnabled) return { items: STATIC_PAGES };
  let items;
  if (params?.group) {
    items = await sql()<Page[]>`
      select * from pages where "group" = ${params.group} order by sort_index, path
    `;
  } else {
    items = await sql()<Page[]>`
      select * from pages order by sort_index, path
    `;
  }
  return { items };
}

export async function getPage(id: string): Promise<Page | null> {
  if (!dbEnabled) return STATIC_PAGES.find(p => p.id === id) ?? null;
  const [row] = await sql()<Page[]>`select * from pages where id = ${id}`;
  return row ?? null;
}

export async function createPage(input: Omit<Page, "id" | "created_at" | "updated_at">): Promise<Page> {
  if (!dbEnabled) throw new Error("Not available in JSON mode");
  const [row] = await sql()<Page[]>`
    insert into pages (path, title, description, "group", icon, required_capability, is_visible, sort_index)
    values (${input.path}, ${input.title}, ${input.description}, ${input.group}, ${input.icon}, ${input.required_capability}, ${input.is_visible}, ${input.sort_index})
    returning *
  `;
  return row;
}

export async function updatePage(id: string, input: Partial<Omit<Page, "id" | "created_at" | "updated_at">>): Promise<Page | null> {
  if (!dbEnabled) throw new Error("Not available in JSON mode");
  const existing = await getPage(id);
  if (!existing) return null;
  const [row] = await sql()<Page[]>`
    update pages set
      path = COALESCE(${input.path}, path),
      title = COALESCE(${input.title}, title),
      description = COALESCE(${input.description}, description),
      "group" = COALESCE(${input.group}, "group"),
      icon = COALESCE(${input.icon}, icon),
      required_capability = COALESCE(${input.required_capability}, required_capability),
      is_visible = COALESCE(${input.is_visible}, is_visible),
      sort_index = COALESCE(${input.sort_index}, sort_index),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return row ?? null;
}

export async function deletePage(id: string): Promise<boolean> {
  if (!dbEnabled) throw new Error("Not available in JSON mode");
  const result = await sql()`delete from pages where id = ${id}`;
  return result.count > 0;
}

export async function syncPages(): Promise<{ created: number; updated: number }> {
  if (!dbEnabled) throw new Error("Not available in JSON mode");
  let created = 0;
  let updated = 0;
  for (const p of SYNC_SOURCE) {
    const existing = await sql()<Page[]>`select id from pages where path = ${p.path}`;
    if (existing.length === 0) {
      await sql()`
        insert into pages (path, title, "group", icon, required_capability, is_visible, sort_index)
        values (${p.path}, ${p.title}, ${p.group}, ${p.icon}, ${p.required_capability}, ${p.is_visible}, ${p.sort_index})
      `;
      created++;
    } else {
      await sql()`
        update pages set
          title = ${p.title},
          "group" = ${p.group},
          icon = ${p.icon},
          required_capability = ${p.required_capability},
          is_visible = ${p.is_visible},
          sort_index = ${p.sort_index},
          updated_at = now()
        where path = ${p.path}
      `;
      updated++;
    }
  }
  return { created, updated };
}

const SYNC_SOURCE = [
  { path: '/', title: '首页', group: '公开', icon: 'Home', required_capability: '', is_visible: true, sort_index: 1 },
  { path: '/today', title: '今日推荐', group: '公开', icon: 'Sparkles', required_capability: '', is_visible: true, sort_index: 2 },
  { path: '/articles/:slug', title: '文章详情', group: '公开', icon: 'FileText', required_capability: '', is_visible: false, sort_index: 2 },
  { path: '/categories', title: '分类浏览', group: '公开', icon: 'Grid3x3', required_capability: '', is_visible: true, sort_index: 3 },
  { path: '/about', title: '关于', group: '公开', icon: 'Info', required_capability: '', is_visible: true, sort_index: 4 },
  { path: '/compare', title: '对比', group: '公开', icon: 'GitCompare', required_capability: '', is_visible: true, sort_index: 5 },
  { path: '/submit', title: '提交项目', group: '公开', icon: 'Upload', required_capability: 'user:submit_project', is_visible: true, sort_index: 6 },
  { path: '/me', title: '个人中心', group: '用户', icon: 'User', required_capability: '', is_visible: true, sort_index: 10 },
  { path: '/dev/dashboard', title: '开发者总览', group: '开发者', icon: 'LayoutDashboard', required_capability: 'dev_panel_access', is_visible: true, sort_index: 20 },
  { path: '/dev/organizations', title: '组织管理', group: '开发者', icon: 'Building2', required_capability: 'dev_panel_access', is_visible: true, sort_index: 21 },
  { path: '/dev/projects', title: '项目管理', group: '开发者', icon: 'Package', required_capability: 'dev_panel_access', is_visible: true, sort_index: 22 },
  { path: '/dev/bugs', title: 'Bug 反馈', group: '开发者', icon: 'Bug', required_capability: 'dev:bug_manage', is_visible: true, sort_index: 23 },
  { path: '/dev/comments', title: '评论管理', group: '开发者', icon: 'MessageSquare', required_capability: 'dev:comment_manage', is_visible: true, sort_index: 24 },
  { path: '/admin/dashboard', title: '运维总览', group: '运维', icon: 'LayoutDashboard', required_capability: 'admin_panel_access', is_visible: true, sort_index: 30 },
  { path: '/admin/stories', title: '文章管理', group: '运维', icon: 'FileText', required_capability: 'story:manage', is_visible: true, sort_index: 31 },
  { path: '/admin/projects', title: '项目管理', group: '运维', icon: 'Package', required_capability: 'project:read', is_visible: true, sort_index: 32 },
  { path: '/admin/review', title: '审核', group: '运维', icon: 'ClipboardCheck', required_capability: 'submission:read', is_visible: true, sort_index: 33 },
  { path: '/admin/users', title: '用户权限', group: '运维', icon: 'Users', required_capability: 'user:read', is_visible: true, sort_index: 34 },
  { path: '/admin/developers', title: '开发者与组织', group: '运维', icon: 'UserCog', required_capability: 'dev:developer_manage', is_visible: true, sort_index: 35 },
  { path: '/admin/media', title: '图床管理', group: '运维', icon: 'Image', required_capability: 'media:read', is_visible: true, sort_index: 36 },
  { path: '/admin/audit', title: '审计日志', group: '运维', icon: 'ScrollText', required_capability: 'audit:read', is_visible: true, sort_index: 37 },
  { path: '/admin/analytics', title: '数据分析', group: '运维', icon: 'BarChart3', required_capability: 'analytics:read', is_visible: true, sort_index: 38 },
  { path: '/admin/routes', title: '路由管理', group: '运维', icon: 'Route', required_capability: 'route:manage', is_visible: true, sort_index: 39 },
];

const STATIC_PAGES: Page[] = SYNC_SOURCE.map((p, i) => ({
  id: `static-${i}`,
  ...p,
  description: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));
