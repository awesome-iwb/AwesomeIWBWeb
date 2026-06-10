import { sql } from "../db/client";
import { getAllCapabilityIds } from "./capabilities";

const dbEnabled = Boolean(process.env.DATABASE_URL);

const MAX_PAGE_TEXT = {
  title: 120,
  description: 500,
  group: 80,
  icon: 64,
  capability: 80,
};

const ALLOWED_PAGE_PATHS = new Set([
  "/",
  "/today",
  "/articles/:slug",
  "/categories",
  "/about",
  "/compare",
  "/submit",
  "/me",
  "/dev/dashboard",
  "/dev/organizations",
  "/dev/projects",
  "/dev/bugs",
  "/dev/comments",
  "/admin/dashboard",
  "/admin/stories",
  "/admin/projects",
  "/admin/review",
  "/admin/users",
  "/admin/developers",
  "/admin/media",
  "/admin/audit",
  "/admin/analytics",
  "/admin/routes",
]);
const VALID_CAPABILITIES = new Set(getAllCapabilityIds());

function boundedText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function normalizeSortIndex(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-100000, Math.min(100000, Math.trunc(n)));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export interface Page {
  id: string;
  path: string;
  title: string;
  description: string;
  group: string;
  icon: string;
  required_capability: string;
  is_visible: boolean;
  is_enabled: boolean;
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export function normalizePagePath(value: unknown): string {
  const path = String(value ?? "").trim();
  return ALLOWED_PAGE_PATHS.has(path) ? path : "";
}

export function normalizePageCapability(value: unknown): string | null {
  const capability = boundedText(value, MAX_PAGE_TEXT.capability);
  if (!capability) return "";
  return VALID_CAPABILITIES.has(capability) ? capability : null;
}

function normalizePageRow(row: Page): Page | null {
  const path = normalizePagePath(row.path);
  if (!path) return null;
  const capability = normalizePageCapability(row.required_capability);
  return {
    ...row,
    path,
    title: boundedText(row.title, MAX_PAGE_TEXT.title) || path,
    description: boundedText(row.description, MAX_PAGE_TEXT.description),
    group: boundedText(row.group, MAX_PAGE_TEXT.group),
    icon: boundedText(row.icon, MAX_PAGE_TEXT.icon),
    required_capability: capability ?? "invalid:capability",
    is_visible: normalizeBoolean(row.is_visible, true),
    is_enabled: capability === null ? false : normalizeBoolean(row.is_enabled, true),
    sort_index: normalizeSortIndex(row.sort_index),
  };
}

export function normalizePageInput(input: Partial<Omit<Page, "id" | "created_at" | "updated_at">>) {
  const path = normalizePagePath((input as any)?.path);
  const capability = normalizePageCapability((input as any)?.required_capability);
  if (!path) throw new Error("invalid page path");
  if (capability === null) throw new Error("invalid page capability");
  return {
    path,
    title: boundedText((input as any)?.title, MAX_PAGE_TEXT.title) || path,
    description: boundedText((input as any)?.description, MAX_PAGE_TEXT.description),
    group: boundedText((input as any)?.group, MAX_PAGE_TEXT.group),
    icon: boundedText((input as any)?.icon, MAX_PAGE_TEXT.icon),
    required_capability: capability,
    is_visible: normalizeBoolean((input as any)?.is_visible, true),
    is_enabled: normalizeBoolean((input as any)?.is_enabled, true),
    sort_index: normalizeSortIndex((input as any)?.sort_index),
  };
}

export function normalizePagePatch(input: Partial<Omit<Page, "id" | "created_at" | "updated_at">>) {
  const patch: Partial<Omit<Page, "id" | "created_at" | "updated_at">> = {};
  if (Object.prototype.hasOwnProperty.call(input, "path")) {
    const path = normalizePagePath((input as any).path);
    if (!path) throw new Error("invalid page path");
    patch.path = path;
  }
  if (Object.prototype.hasOwnProperty.call(input, "title")) patch.title = boundedText((input as any).title, MAX_PAGE_TEXT.title);
  if (Object.prototype.hasOwnProperty.call(input, "description")) patch.description = boundedText((input as any).description, MAX_PAGE_TEXT.description);
  if (Object.prototype.hasOwnProperty.call(input, "group")) patch.group = boundedText((input as any).group, MAX_PAGE_TEXT.group);
  if (Object.prototype.hasOwnProperty.call(input, "icon")) patch.icon = boundedText((input as any).icon, MAX_PAGE_TEXT.icon);
  if (Object.prototype.hasOwnProperty.call(input, "required_capability")) {
    const capability = normalizePageCapability((input as any).required_capability);
    if (capability === null) throw new Error("invalid page capability");
    patch.required_capability = capability;
  }
  if (Object.prototype.hasOwnProperty.call(input, "is_visible")) patch.is_visible = normalizeBoolean((input as any).is_visible, true);
  if (Object.prototype.hasOwnProperty.call(input, "is_enabled")) patch.is_enabled = normalizeBoolean((input as any).is_enabled, true);
  if (Object.prototype.hasOwnProperty.call(input, "sort_index")) patch.sort_index = normalizeSortIndex((input as any).sort_index);
  return patch;
}

export async function listPages(params?: { group?: string }): Promise<{ items: Page[] }> {
  if (!dbEnabled) return { items: STATIC_PAGES.map(normalizePageRow).filter((p): p is Page => Boolean(p)) };
  let items;
  if (params?.group) {
    const group = boundedText(params.group, MAX_PAGE_TEXT.group);
    items = await sql()<Page[]>`
      select * from pages where "group" = ${group} order by sort_index, path
    `;
  } else {
    items = await sql()<Page[]>`
      select * from pages order by sort_index, path
    `;
  }
  return { items: items.map(normalizePageRow).filter((p): p is Page => Boolean(p)) };
}

export async function getPage(id: string): Promise<Page | null> {
  if (!dbEnabled) return STATIC_PAGES.map(normalizePageRow).find(p => p?.id === id) ?? null;
  const [row] = await sql()<Page[]>`select * from pages where id = ${id}`;
  return row ? normalizePageRow(row) : null;
}

export async function createPage(input: Omit<Page, "id" | "created_at" | "updated_at">): Promise<Page> {
  if (!dbEnabled) throw new Error("Not available in JSON mode");
  const safeInput = normalizePageInput(input);
  const [row] = await sql()<Page[]>`
    insert into pages (path, title, description, "group", icon, required_capability, is_visible, is_enabled, sort_index)
    values (${safeInput.path}, ${safeInput.title}, ${safeInput.description}, ${safeInput.group}, ${safeInput.icon}, ${safeInput.required_capability}, ${safeInput.is_visible}, ${safeInput.is_enabled}, ${safeInput.sort_index})
    returning *
  `;
  return normalizePageRow(row) ?? row;
}

export async function updatePage(id: string, input: Partial<Omit<Page, "id" | "created_at" | "updated_at">>): Promise<Page | null> {
  if (!dbEnabled) throw new Error("Not available in JSON mode");
  const existing = await getPage(id);
  if (!existing) return null;
  const safeInput = normalizePagePatch(input);
  const [row] = await sql()<Page[]>`
    update pages set
      path = COALESCE(${safeInput.path}, path),
      title = COALESCE(${safeInput.title}, title),
      description = COALESCE(${safeInput.description}, description),
      "group" = COALESCE(${safeInput.group}, "group"),
      icon = COALESCE(${safeInput.icon}, icon),
      required_capability = COALESCE(${safeInput.required_capability}, required_capability),
      is_visible = COALESCE(${safeInput.is_visible}, is_visible),
      is_enabled = COALESCE(${safeInput.is_enabled}, is_enabled),
      sort_index = COALESCE(${safeInput.sort_index}, sort_index),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return row ? normalizePageRow(row) : null;
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
        insert into pages (path, title, "group", icon, required_capability, is_visible, is_enabled, sort_index)
        values (${p.path}, ${p.title}, ${p.group}, ${p.icon}, ${p.required_capability}, ${p.is_visible}, ${p.is_enabled}, ${p.sort_index})
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
          is_enabled = COALESCE(${p.is_enabled}, is_enabled),
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
  { path: '/', title: '首页', group: '公开', icon: 'Home', required_capability: '', is_visible: true, is_enabled: true, sort_index: 1 },
  { path: '/today', title: '今日推荐', group: '公开', icon: 'Sparkles', required_capability: '', is_visible: true, is_enabled: true, sort_index: 2 },
  { path: '/articles/:slug', title: '文章详情', group: '公开', icon: 'FileText', required_capability: '', is_visible: false, is_enabled: true, sort_index: 2 },
  { path: '/categories', title: '分类浏览', group: '公开', icon: 'Grid3x3', required_capability: '', is_visible: true, is_enabled: true, sort_index: 3 },
  { path: '/about', title: '关于', group: '公开', icon: 'Info', required_capability: '', is_visible: true, is_enabled: true, sort_index: 4 },
  { path: '/compare', title: '对比', group: '公开', icon: 'GitCompare', required_capability: '', is_visible: true, is_enabled: true, sort_index: 5 },
  { path: '/submit', title: '提交项目', group: '公开', icon: 'Upload', required_capability: 'user:submit_project', is_visible: true, is_enabled: true, sort_index: 6 },
  { path: '/me', title: '个人中心', group: '用户', icon: 'User', required_capability: '', is_visible: true, is_enabled: true, sort_index: 10 },
  { path: '/dev/dashboard', title: '开发者总览', group: '开发者', icon: 'LayoutDashboard', required_capability: 'dev_panel_access', is_visible: true, is_enabled: true, sort_index: 20 },
  { path: '/dev/organizations', title: '组织管理', group: '开发者', icon: 'Building2', required_capability: 'dev_panel_access', is_visible: true, is_enabled: true, sort_index: 21 },
  { path: '/dev/projects', title: '项目管理', group: '开发者', icon: 'Package', required_capability: 'dev_panel_access', is_visible: true, is_enabled: true, sort_index: 22 },
  { path: '/dev/bugs', title: 'Bug 反馈', group: '开发者', icon: 'Bug', required_capability: 'dev:bug_manage', is_visible: true, is_enabled: true, sort_index: 23 },
  { path: '/dev/comments', title: '评论管理', group: '开发者', icon: 'MessageSquare', required_capability: 'dev:comment_manage', is_visible: true, is_enabled: true, sort_index: 24 },
  { path: '/admin/dashboard', title: '运维总览', group: '运维', icon: 'LayoutDashboard', required_capability: 'admin_panel_access', is_visible: true, is_enabled: true, sort_index: 30 },
  { path: '/admin/stories', title: '文章管理', group: '运维', icon: 'FileText', required_capability: 'story:manage', is_visible: true, is_enabled: true, sort_index: 31 },
  { path: '/admin/projects', title: '项目管理', group: '运维', icon: 'Package', required_capability: 'project:read', is_visible: true, is_enabled: true, sort_index: 32 },
  { path: '/admin/review', title: '审核', group: '运维', icon: 'ClipboardCheck', required_capability: 'submission:read', is_visible: true, is_enabled: true, sort_index: 33 },
  { path: '/admin/users', title: '用户权限', group: '运维', icon: 'Users', required_capability: 'user:read', is_visible: true, is_enabled: true, sort_index: 34 },
  { path: '/admin/developers', title: '开发者与组织', group: '运维', icon: 'UserCog', required_capability: 'dev:developer_manage', is_visible: true, is_enabled: true, sort_index: 35 },
  { path: '/admin/media', title: '图床管理', group: '运维', icon: 'Image', required_capability: 'media:read', is_visible: true, is_enabled: true, sort_index: 36 },
  { path: '/admin/audit', title: '审计日志', group: '运维', icon: 'ScrollText', required_capability: 'audit:read', is_visible: true, is_enabled: true, sort_index: 37 },
  { path: '/admin/analytics', title: '数据分析', group: '运维', icon: 'BarChart3', required_capability: 'analytics:read', is_visible: true, is_enabled: true, sort_index: 38 },
  { path: '/admin/routes', title: '路由管理', group: '运维', icon: 'Route', required_capability: 'route:manage', is_visible: true, is_enabled: true, sort_index: 39 },
];

const STATIC_PAGES: Page[] = SYNC_SOURCE.map((p, i) => ({
  id: `static-${i}`,
  ...p,
  description: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));
