import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

const SUPERADMIN_INITIAL_USERNAME = (process.env.SUPERADMIN_INITIAL_USERNAME ?? "lincube").trim();

export type Capability = {
  id: string;
  name: string;
  category: string;
  description: string;
  sort_index: number;
};

const ALL_CAPABILITIES: Capability[] = [
  { id: "user:comment", name: "发表评论", category: "user", description: "发表项目评论", sort_index: 10 },
  { id: "user:avatar", name: "上传头像", category: "user", description: "上传和更改头像", sort_index: 20 },
  { id: "user:feedback", name: "提交反馈", category: "user", description: "提交 Bug 反馈", sort_index: 30 },
  { id: "user:submit_project", name: "提交项目", category: "user", description: "提交新项目申请", sort_index: 40 },
  { id: "user:profile", name: "修改资料", category: "user", description: "修改个人资料", sort_index: 50 },
  { id: "user:create_org", name: "创建组织", category: "user", description: "申请创建组织", sort_index: 60 },
  { id: "admin_panel_access", name: "访问运维后台", category: "panel", description: "查看和进入运维管理后台", sort_index: 10 },
  { id: "dev_panel_access", name: "访问开发者后台", category: "panel", description: "查看和进入开发者后台", sort_index: 20 },
  { id: "project:read", name: "查看项目", category: "project", description: "查看项目列表和详情", sort_index: 100 },
  { id: "project:create", name: "创建项目", category: "project", description: "创建新项目", sort_index: 200 },
  { id: "project:update", name: "编辑项目", category: "project", description: "编辑项目信息", sort_index: 300 },
  { id: "project:delete", name: "删除项目", category: "project", description: "删除项目", sort_index: 400 },
  { id: "project:rollback", name: "版本回滚", category: "project", description: "回滚项目到历史版本", sort_index: 500 },
  { id: "project:import", name: "批量导入", category: "project", description: "导入 JSON/CSV 数据", sort_index: 600 },
  { id: "project:export", name: "批量导出", category: "project", description: "导出项目数据", sort_index: 700 },
  { id: "category:manage", name: "分类管理", category: "category", description: "增删改分类", sort_index: 800 },
  { id: "submission:read", name: "查看提交", category: "submission", description: "查看项目提交列表", sort_index: 900 },
  { id: "submission:approve", name: "审核通过", category: "submission", description: "批准项目提交", sort_index: 1000 },
  { id: "submission:reject", name: "审核驳回", category: "submission", description: "驳回项目提交", sort_index: 1100 },
  { id: "moderation:read", name: "查看审核队列", category: "moderation", description: "查看内容审核队列", sort_index: 1200 },
  { id: "moderation:approve", name: "批准内容", category: "moderation", description: "批准评论或 Bug 反馈", sort_index: 1300 },
  { id: "moderation:reject", name: "驳回内容", category: "moderation", description: "驳回评论或 Bug 反馈", sort_index: 1400 },
  { id: "user:read", name: "查看用户", category: "user", description: "查看用户列表", sort_index: 1500 },
  { id: "user:manage", name: "管理用户", category: "user", description: "修改用户角色、状态、权限", sort_index: 1600 },
  { id: "user:delete", name: "删除用户", category: "user", description: "删除用户账号", sort_index: 1650 },
  { id: "audit:read", name: "查看审计日志", category: "audit", description: "查看系统审计日志", sort_index: 1700 },
  { id: "story:manage", name: "故事管理", category: "story", description: "管理首页故事", sort_index: 1800 },
  { id: "feedback:manage", name: "反馈管理", category: "feedback", description: "管理反馈状态和标签", sort_index: 1900 },
  { id: "comment:manage", name: "管理评论", category: "comment", description: "管理自己和他人的评论/Issue状态", sort_index: 1950 },
  { id: "media:read", name: "查看媒体", category: "media", description: "查看媒体资产和引用关系", sort_index: 2000 },
  { id: "media:manage", name: "管理媒体", category: "media", description: "软删除和恢复媒体资产", sort_index: 2010 },
  { id: "dev:project_edit", name: "编辑项目", category: "dev", description: "编辑自己参与的项目", sort_index: 2100 },
  { id: "dev:bug_manage", name: "管理 Bug", category: "dev", description: "处理自己项目的 Bug 反馈", sort_index: 2200 },
  { id: "dev:comment_manage", name: "管理评论", category: "dev", description: "管理自己项目的评论", sort_index: 2300 },
  { id: "dev:stats_view", name: "查看数据", category: "dev", description: "查看自己项目的统计数据", sort_index: 2400 },
  { id: "dev:member_manage", name: "管理成员", category: "dev", description: "管理项目/组织成员", sort_index: 2500 },
  { id: "org:review", name: "审核组织", category: "org", description: "审核组织创建申请", sort_index: 2600 },
  { id: "claim:review", name: "审核认领", category: "claim", description: "审核项目认领申请", sort_index: 2700 },
  { id: "org:manage", name: "管理组织", category: "org", description: "管理组织状态", sort_index: 2800 },
];

const ALL_CAPABILITY_IDS = new Set(ALL_CAPABILITIES.map(c => c.id));

export function getAllCapabilities(): Capability[] {
  return [...ALL_CAPABILITIES];
}

export function getAllCapabilityIds(): string[] {
  return ALL_CAPABILITIES.map(c => c.id);
}

export function isSuperadmin(username: string): boolean {
  return username.trim().toLowerCase() === SUPERADMIN_INITIAL_USERNAME.toLowerCase();
}

export async function listCapabilities(): Promise<Capability[]> {
  if (!dbEnabled) return ALL_CAPABILITIES;
  const rows = await sql()<Capability[]>`
    select id, name, category, description, sort_index
    from capabilities
    order by sort_index
  `;
  return rows;
}

export async function getUserCapabilities(userId: string): Promise<string[]> {
  if (!dbEnabled) return ALL_CAPABILITIES.map(c => c.id);
  const rows = await sql()<Array<{ capability_id: string }>>`
    select capability_id from user_capabilities where user_id = ${userId}
  `;
  return rows.map(r => r.capability_id);
}

export async function userHasCapability(userId: string, username: string, capabilityId: string): Promise<boolean> {
  if (isSuperadmin(username)) return true;
  if (!ALL_CAPABILITY_IDS.has(capabilityId)) return false;
  if (!dbEnabled) return true;
  const rows = await sql()<Array<{ capability_id: string }>>`
    select capability_id from user_capabilities where user_id = ${userId} and capability_id = ${capabilityId}
  `;
  return rows.length > 0;
}

export async function setUserCapabilities(userId: string, capabilityIds: string[]): Promise<void> {
  const validIds = capabilityIds.filter(id => ALL_CAPABILITY_IDS.has(id));
  if (!dbEnabled) return;
  await sql()`delete from user_capabilities where user_id = ${userId}`;
  if (validIds.length === 0) return;
  const values = validIds.map(cid => `('${userId}', '${cid}')`).join(", ");
  await sql().unsafe(`insert into user_capabilities (user_id, capability_id) values ${values} on conflict do nothing`);
}

export async function getUserCapabilitiesWithInfo(userId: string, username: string): Promise<{
  is_superadmin: boolean;
  capabilities: string[];
  all_capabilities: Capability[];
}> {
  const allCaps = await listCapabilities();
  if (isSuperadmin(username)) {
    return {
      is_superadmin: true,
      capabilities: allCaps.map(c => c.id),
      all_capabilities: allCaps,
    };
  }
  const userCaps = await getUserCapabilities(userId);
  return {
    is_superadmin: false,
    capabilities: userCaps,
    all_capabilities: allCaps,
  };
}

export type RoleTemplate = {
  name: string;
  capabilityIds: string[];
};

export const ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  superadmin: {
    name: "超级管理员",
    capabilityIds: getAllCapabilityIds(),
  },
  user: {
    name: "用户",
    capabilityIds: [
      "user:comment", "user:avatar", "user:feedback",
      "user:submit_project", "user:profile", "user:create_org",
    ],
  },
  developer: {
    name: "开发者",
    capabilityIds: [
      "user:comment", "user:avatar", "user:feedback",
      "user:submit_project", "user:profile", "user:create_org",
      "dev_panel_access",
      "dev:project_edit", "dev:bug_manage", "dev:comment_manage",
      "dev:stats_view", "dev:member_manage",
    ],
  },
  reviewer: {
    name: "审核员",
    capabilityIds: [
      "admin_panel_access",
      "submission:read", "submission:approve", "submission:reject",
      "moderation:read", "moderation:approve", "moderation:reject",
      "feedback:manage", "comment:manage",
      "org:review", "claim:review",
    ],
  },
  editor: {
    name: "编辑",
    capabilityIds: [
      "admin_panel_access",
      "story:manage", "project:read", "project:create", "project:update",
      "category:manage", "media:read", "media:manage",
    ],
  },
};

export function getRoleTemplates(): Record<string, RoleTemplate> {
  return ROLE_TEMPLATES;
}
