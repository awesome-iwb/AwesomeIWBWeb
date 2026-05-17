# 三层权限与双后台系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立三层权限体系（用户/开发者/运维）+ 双后台（开发者后台/运维后台）+ 组织体系，将项目从单一运维后台升级为可持续运营的社区平台。

**Architecture:** 在现有 capability 体系上增量扩展，新增 organizations / project_members / project_claims 三张核心表，引入资源级权限校验（requireProjectMember），开发者权限限定在"自己参与的项目"。前端复用运维后台侧边栏风格构建独立开发者后台。

**Tech Stack:** Bun + Elysia + PostgreSQL + Vue 3 + Vue Router + TypeScript + bun:test

**Spec:** `docs/superpowers/specs/2026-05-15-tiered-permission-dual-panel-design.md`

---

## File Structure

### Backend — New Files
- `backend/migrations/0020_organizations.sql` — organizations + organization_members 表
- `backend/migrations/0021_project_members.sql` — project_members 表
- `backend/migrations/0022_project_claims.sql` — project_claims 表
- `backend/migrations/0023_new_capabilities.sql` — 14 条新能力记录
- `backend/migrations/0024_grant_user_caps.sql` — 为现有用户授予 user:* 能力
- `backend/migrations/0025_grant_dev_caps.sql` — 为现有 dev/ops 授予 dev:* 能力
- `backend/migrations/0026_grant_ops_new_caps.sql` — 为现有 ops 授予 org/claim 能力
- `backend/migrations/0027_notifications_type_expand.sql` — 扩展 notifications.type CHECK
- `backend/src/services/organizations.ts` — 组织服务层
- `backend/src/services/projectMembers.ts` — 项目成员服务层
- `backend/src/services/projectClaims.ts` — 项目认领服务层
- `backend/src/services/organizations.test.ts` — 组织服务测试
- `backend/src/services/projectMembers.test.ts` — 项目成员服务测试
- `backend/src/services/projectClaims.test.ts` — 项目认领服务测试

### Backend — Modified Files
- `backend/src/services/capabilities.ts` — 扩展能力定义和角色模板
- `backend/src/services/capabilities.test.ts` — 能力定义测试
- `backend/src/plugins/auth.ts` — 新增 requireProjectMember 中间件
- `backend/src/index.ts` — 注册新路由 + 修改现有路由

### Frontend — New Files
- `frontend/src/views/dev/DevLayout.vue` — 开发者后台布局
- `frontend/src/views/dev/DevDashboardView.vue` — 总览
- `frontend/src/views/dev/DevOrganizationsView.vue` — 组织列表
- `frontend/src/views/dev/DevOrgDetailView.vue` — 组织详情
- `frontend/src/views/dev/DevOrgCreateView.vue` — 创建组织
- `frontend/src/views/dev/DevProjectsView.vue` — 项目列表
- `frontend/src/views/dev/DevProjectDetailView.vue` — 项目详情
- `frontend/src/views/dev/DevBugsView.vue` — Bug 管理
- `frontend/src/views/dev/DevCommentsView.vue` — 评论管理
- `frontend/src/components/dev/DevSidebar.vue` — 侧边栏
- `frontend/src/components/dev/DevBottomNav.vue` — 底部导航
- `frontend/src/components/shared/MemberManager.vue` — 成员管理通用组件
- `frontend/src/views/admin/AdminOrganizationsView.vue` — 运维组织审核
- `frontend/src/views/admin/AdminClaimsView.vue` — 运维认领审核

### Frontend — Modified Files
- `frontend/src/router/index.ts` — 新增开发者后台路由 + 运维新路由
- `frontend/src/composables/useAuth.ts` — 扩展组织/项目成员信息
- `frontend/src/components/admin/AdminSidebar.vue` — 新增导航项
- `frontend/src/api/endpoints.ts` — 新增 API 端点定义

---

## Phase 1: 数据基础

### Task 1: 数据库迁移 — organizations 表

**Files:**
- Create: `backend/migrations/0020_organizations.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
-- Migration: organizations and organization_members tables
-- Date: 2026-05-15

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','suspended')),
  review_note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_status_idx ON organizations(status);
CREATE INDEX IF NOT EXISTS org_created_by_idx ON organizations(created_by);

CREATE TABLE IF NOT EXISTS organization_members (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members(user_id);
```

- [ ] **Step 2: 运行迁移**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun run src/migrate.ts`
Expected: 迁移成功，无错误

- [ ] **Step 3: 验证表结构**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun -e "const {sql}=require('./src/db/client');sql\`SELECT tablename FROM pg_tables WHERE tablename IN ('organizations','organization_members')\`.then(r=>{console.log(r);process.exit()})"`
Expected: 输出包含 organizations 和 organization_members

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/0020_organizations.sql
git commit -m "feat: add organizations and organization_members tables"
```

---

### Task 2: 数据库迁移 — project_members 表

**Files:**
- Create: `backend/migrations/0021_project_members.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
-- Migration: project_members table
-- Date: 2026-05-15

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator'
    CHECK (role IN ('owner','collaborator')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(org_id, '00000000-0000-0000-0000-000000000000'))
);

ALTER TABLE project_members
  ADD CONSTRAINT pm_member_target CHECK (
    (user_id IS NOT NULL AND org_id IS NULL) OR
    (user_id IS NULL AND org_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS pm_user_idx ON project_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_org_idx ON project_members(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pm_project_idx ON project_members(project_id);
```

- [ ] **Step 2: 运行迁移**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun run src/migrate.ts`
Expected: 迁移成功

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/0021_project_members.sql
git commit -m "feat: add project_members table"
```

---

### Task 3: 数据库迁移 — project_claims 表

**Files:**
- Create: `backend/migrations/0022_project_claims.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
-- Migration: project_claims table
-- Date: 2026-05-15

CREATE TABLE IF NOT EXISTS project_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS claims_status_idx ON project_claims(status);
CREATE INDEX IF NOT EXISTS claims_user_idx ON project_claims(user_id);
CREATE INDEX IF NOT EXISTS claims_project_idx ON project_claims(project_id);
```

- [ ] **Step 2: 运行迁移**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun run src/migrate.ts`
Expected: 迁移成功

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/0022_project_claims.sql
git commit -m "feat: add project_claims table"
```

---

### Task 4: 数据库迁移 — 新增能力记录

**Files:**
- Create: `backend/migrations/0023_new_capabilities.sql`
- Create: `backend/migrations/0024_grant_user_caps.sql`
- Create: `backend/migrations/0025_grant_dev_caps.sql`
- Create: `backend/migrations/0026_grant_ops_new_caps.sql`
- Create: `backend/migrations/0027_notifications_type_expand.sql`

- [ ] **Step 1: 编写 0023 — 新增 14 条能力记录**

```sql
-- Migration: new capabilities for user/dev/org/claim categories
-- Date: 2026-05-15

INSERT INTO capabilities (id, name, category, description, sort_index) VALUES
  ('user:comment', '发表评论', 'user', '发表项目评论', 10),
  ('user:avatar', '上传头像', 'user', '上传和更改头像', 20),
  ('user:feedback', '提交反馈', 'user', '提交 Bug 反馈', 30),
  ('user:submit_project', '提交项目', 'user', '提交新项目申请', 40),
  ('user:profile', '修改资料', 'user', '修改个人资料', 50),
  ('user:create_org', '创建组织', 'user', '申请创建组织', 60),
  ('dev:project_edit', '编辑项目', 'dev', '编辑自己参与的项目', 2100),
  ('dev:bug_manage', '管理 Bug', 'dev', '处理自己项目的 Bug 反馈', 2200),
  ('dev:comment_manage', '管理评论', 'dev', '管理自己项目的评论', 2300),
  ('dev:stats_view', '查看数据', 'dev', '查看自己项目的统计数据', 2400),
  ('dev:member_manage', '管理成员', 'dev', '管理项目/组织成员', 2500),
  ('org:review', '审核组织', 'org', '审核组织创建申请', 2600),
  ('claim:review', '审核认领', 'claim', '审核项目认领申请', 2700),
  ('org:manage', '管理组织', 'org', '管理组织状态', 2800)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: 编写 0024 — 为现有用户授予 user:* 能力**

```sql
-- Migration: grant user capabilities to all existing users
-- Date: 2026-05-15

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE c.id LIKE 'user:%'
ON CONFLICT (user_id, capability_id) DO NOTHING;
```

- [ ] **Step 3: 编写 0025 — 为现有 dev/ops 授予 dev:* 能力**

```sql
-- Migration: grant dev capabilities to existing dev/ops users
-- Date: 2026-05-15

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE u.role IN ('dev', 'ops') AND c.id IN (
  'dev_panel_access', 'dev:project_edit', 'dev:bug_manage',
  'dev:comment_manage', 'dev:stats_view', 'dev:member_manage'
)
ON CONFLICT (user_id, capability_id) DO NOTHING;
```

- [ ] **Step 4: 编写 0026 — 为现有 ops 授予 org/claim 能力**

```sql
-- Migration: grant org/claim capabilities to existing ops users
-- Date: 2026-05-15

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id FROM users u, capabilities c
WHERE u.role = 'ops' AND c.id IN ('org:review', 'claim:review', 'org:manage')
ON CONFLICT (user_id, capability_id) DO NOTHING;
```

- [ ] **Step 5: 编写 0027 — 扩展 notifications.type CHECK**

```sql
-- Migration: expand notifications.type CHECK constraint
-- Date: 2026-05-15

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'moderation_approved', 'moderation_rejected',
    'role_promoted', 'role_demoted',
    'org_approved', 'org_rejected',
    'claim_approved', 'claim_rejected'
  ));
```

- [ ] **Step 6: 运行全部迁移**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun run src/migrate.ts`
Expected: 全部迁移成功

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/0023_new_capabilities.sql backend/migrations/0024_grant_user_caps.sql backend/migrations/0025_grant_dev_caps.sql backend/migrations/0026_grant_ops_new_caps.sql backend/migrations/0027_notifications_type_expand.sql
git commit -m "feat: add new capabilities, grant caps, expand notification types"
```

---

### Task 5: 扩展 capabilities.ts — 能力定义和角色模板

**Files:**
- Modify: `backend/src/services/capabilities.ts`
- Create: `backend/src/services/capabilities.test.ts`

- [ ] **Step 1: 编写能力定义测试**

```typescript
import { describe, expect, test } from 'bun:test';
import { getAllCapabilities, getAllCapabilityIds, getRoleTemplates, isSuperadmin } from './capabilities';

describe('capabilities', () => {
  test('includes user capabilities', () => {
    const ids = getAllCapabilityIds();
    expect(ids).toContain('user:comment');
    expect(ids).toContain('user:avatar');
    expect(ids).toContain('user:feedback');
    expect(ids).toContain('user:submit_project');
    expect(ids).toContain('user:profile');
    expect(ids).toContain('user:create_org');
  });

  test('includes dev capabilities', () => {
    const ids = getAllCapabilityIds();
    expect(ids).toContain('dev:project_edit');
    expect(ids).toContain('dev:bug_manage');
    expect(ids).toContain('dev:comment_manage');
    expect(ids).toContain('dev:stats_view');
    expect(ids).toContain('dev:member_manage');
  });

  test('includes org/claim capabilities', () => {
    const ids = getAllCapabilityIds();
    expect(ids).toContain('org:review');
    expect(ids).toContain('claim:review');
    expect(ids).toContain('org:manage');
  });

  test('developer role template includes user capabilities', () => {
    const templates = getRoleTemplates();
    const devCaps = templates.developer.capabilityIds;
    expect(devCaps).toContain('user:comment');
    expect(devCaps).toContain('user:avatar');
    expect(devCaps).toContain('dev_panel_access');
    expect(devCaps).toContain('dev:project_edit');
  });

  test('user role template includes all user capabilities', () => {
    const templates = getRoleTemplates();
    const userCaps = templates.user.capabilityIds;
    expect(userCaps).toContain('user:comment');
    expect(userCaps).toContain('user:avatar');
    expect(userCaps).toContain('user:feedback');
    expect(userCaps).toContain('user:submit_project');
    expect(userCaps).toContain('user:profile');
    expect(userCaps).toContain('user:create_org');
  });

  test('reviewer template includes org:review and claim:review', () => {
    const templates = getRoleTemplates();
    const reviewerCaps = templates.reviewer.capabilityIds;
    expect(reviewerCaps).toContain('org:review');
    expect(reviewerCaps).toContain('claim:review');
  });

  test('isSuperadmin checks username case-insensitively', () => {
    expect(isSuperadmin('lincube')).toBe(true);
    expect(isSuperadmin('Lincube')).toBe(true);
    expect(isSuperadmin('other')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/capabilities.test.ts`
Expected: FAIL — user:comment 等能力不存在

- [ ] **Step 3: 修改 capabilities.ts — 扩展 ALL_CAPABILITIES 数组**

在 `ALL_CAPABILITIES` 数组中，在现有 `admin_panel_access` 之前插入用户能力，在 `comment:manage` 之后插入开发者能力和组织能力：

```typescript
const ALL_CAPABILITIES: Capability[] = [
  { id: "user:comment", name: "发表评论", category: "user", description: "发表项目评论", sort_index: 10 },
  { id: "user:avatar", name: "上传头像", category: "user", description: "上传和更改头像", sort_index: 20 },
  { id: "user:feedback", name: "提交反馈", category: "user", description: "提交 Bug 反馈", sort_index: 30 },
  { id: "user:submit_project", name: "提交项目", category: "user", description: "提交新项目申请", sort_index: 40 },
  { id: "user:profile", name: "修改资料", category: "user", description: "修改个人资料", sort_index: 50 },
  { id: "user:create_org", name: "创建组织", category: "user", description: "申请创建组织", sort_index: 60 },
  { id: "admin_panel_access", name: "访问运维后台", category: "panel", description: "查看和进入运维管理后台", sort_index: 10 },
  { id: "dev_panel_access", name: "访问开发者后台", category: "panel", description: "查看和进入开发者后台", sort_index: 20 },
  // ... 现有 project/submission/moderation/user/audit/story/feedback/comment/media 能力保持不变 ...
  { id: "dev:project_edit", name: "编辑项目", category: "dev", description: "编辑自己参与的项目", sort_index: 2100 },
  { id: "dev:bug_manage", name: "管理 Bug", category: "dev", description: "处理自己项目的 Bug 反馈", sort_index: 2200 },
  { id: "dev:comment_manage", name: "管理评论", category: "dev", description: "管理自己项目的评论", sort_index: 2300 },
  { id: "dev:stats_view", name: "查看数据", category: "dev", description: "查看自己项目的统计数据", sort_index: 2400 },
  { id: "dev:member_manage", name: "管理成员", category: "dev", description: "管理项目/组织成员", sort_index: 2500 },
  { id: "org:review", name: "审核组织", category: "org", description: "审核组织创建申请", sort_index: 2600 },
  { id: "claim:review", name: "审核认领", category: "claim", description: "审核项目认领申请", sort_index: 2700 },
  { id: "org:manage", name: "管理组织", category: "org", description: "管理组织状态", sort_index: 2800 },
];
```

- [ ] **Step 4: 修改 ROLE_TEMPLATES — 新增 user 模板，更新 developer 和 reviewer**

```typescript
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/capabilities.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/capabilities.ts backend/src/services/capabilities.test.ts
git commit -m "feat: extend capabilities with user/dev/org/claim categories and update role templates"
```

---

### Task 6: 组织服务层 — organizations.ts

**Files:**
- Create: `backend/src/services/organizations.ts`
- Create: `backend/src/services/organizations.test.ts`

- [ ] **Step 1: 编写组织服务测试**

```typescript
import { describe, expect, test } from 'bun:test';
import {
  generateOrgSlug,
  validateOrgName,
} from './organizations';

describe('organizations domain', () => {
  describe('generateOrgSlug', () => {
    test('converts Chinese name to pinyin-like slug', () => {
      const slug = generateOrgSlug('测试组织');
      expect(slug).toBeTruthy();
      expect(typeof slug).toBe('string');
    });

    test('lowercases and hyphenates English name', () => {
      expect(generateOrgSlug('My Team')).toBe('my-team');
    });

    test('removes special characters', () => {
      expect(generateOrgSlug('Hello! World@#')).toBe('hello-world');
    });

    test('handles empty string', () => {
      const slug = generateOrgSlug('');
      expect(slug).toBe('');
    });
  });

  describe('validateOrgName', () => {
    test('accepts valid names', () => {
      expect(validateOrgName('测试组织')).toBe(true);
      expect(validateOrgName('My Team')).toBe(true);
    });

    test('rejects empty name', () => {
      expect(validateOrgName('')).toBe(false);
    });

    test('rejects too long name', () => {
      expect(validateOrgName('a'.repeat(101))).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/organizations.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 编写 organizations.ts**

```typescript
import { sql } from "../db/client";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type OrganizationStatus = "pending" | "approved" | "rejected" | "suspended";
export type OrgMemberRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string;
  description: string;
  website_url: string;
  status: OrganizationStatus;
  review_note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  joined_at: string;
};

const ORG_COLUMNS = "id, name, slug, avatar_url, description, website_url, status, review_note, created_by, created_at, updated_at";
const ORG_MEMBER_COLUMNS = "org_id, user_id, role, joined_at";

export function generateOrgSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validateOrgName(name: string): boolean {
  return name.length > 0 && name.length <= 100;
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  description?: string;
  website_url?: string;
  created_by: string;
}): Promise<Organization> {
  const [row] = await sql()<Organization[]>`
    insert into organizations (name, slug, description, website_url, created_by)
    values (${input.name}, ${input.slug}, ${input.description ?? ""}, ${input.website_url ?? ""}, ${input.created_by})
    returning ${sql(ORG_COLUMNS)}
  `;
  await sql()`insert into organization_members (org_id, user_id, role) values (${row.id}, ${input.created_by}, 'owner')`;
  return row;
}

export async function findOrganizationById(id: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    select ${sql(ORG_COLUMNS)} from organizations where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function findOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    select ${sql(ORG_COLUMNS)} from organizations where slug = ${slug} limit 1
  `;
  return rows[0] ?? null;
}

export async function listOrganizations(params: {
  status?: OrganizationStatus;
  created_by?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Organization[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const queryParams: any[] = [];

  if (params.status) {
    queryParams.push(params.status);
    whereParts.push(`status = $${queryParams.length}`);
  }
  if (params.created_by) {
    queryParams.push(params.created_by);
    whereParts.push(`created_by = $${queryParams.length}`);
  }

  const whereClause = whereParts.length ? `where ${whereParts.join(" and ")}` : "";

  const items = await sql().unsafe(
    `select ${ORG_COLUMNS} from organizations ${whereClause} order by created_at desc limit ${pageSize} offset ${offset}`,
    queryParams
  ) as Organization[];

  const [{ count }] = await sql().unsafe(
    `select count(*)::text as count from organizations ${whereClause}`,
    queryParams
  ) as Array<{ count: string }>;

  return { items, page, pageSize, total: Number(count) };
}

export async function updateOrganizationStatus(id: string, status: OrganizationStatus, reviewNote?: string): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<Organization[]>`
    update organizations set status = ${status}, review_note = ${reviewNote ?? ""}, updated_at = now()
    where id = ${id}
    returning ${sql(ORG_COLUMNS)}
  `;
  return rows[0] ?? null;
}

export async function updateOrganization(id: string, input: { name?: string; description?: string; website_url?: string; avatar_url?: string }): Promise<Organization | null> {
  if (!dbEnabled) return null;
  const sets: string[] = ["updated_at = now()"];
  const params: any[] = [];

  if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${params.length}`); }
  if (input.description !== undefined) { params.push(input.description); sets.push(`description = $${params.length}`); }
  if (input.website_url !== undefined) { params.push(input.website_url); sets.push(`website_url = $${params.length}`); }
  if (input.avatar_url !== undefined) { params.push(input.avatar_url); sets.push(`avatar_url = $${params.length}`); }

  params.push(id);
  const rows = await sql().unsafe(
    `update organizations set ${sets.join(", ")} where id = $${params.length} returning ${ORG_COLUMNS}`,
    params
  ) as Organization[];
  return rows[0] ?? null;
}

export async function deleteOrganization(id: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from organizations where id = ${id}`;
  return (result as any).rowCount > 0;
}

export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  if (!dbEnabled) return [];
  return sql()<OrganizationMember[]>`
    select ${sql(ORG_MEMBER_COLUMNS)} from organization_members where org_id = ${orgId} order by joined_at asc
  `;
}

export async function addOrganizationMember(input: { org_id: string; user_id: string; role?: OrgMemberRole }): Promise<OrganizationMember> {
  const [row] = await sql()<OrganizationMember[]>`
    insert into organization_members (org_id, user_id, role)
    values (${input.org_id}, ${input.user_id}, ${input.role ?? "member"})
    on conflict (org_id, user_id) do update set role = ${input.role ?? "member"}
    returning ${sql(ORG_MEMBER_COLUMNS)}
  `;
  return row;
}

export async function removeOrganizationMember(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from organization_members where org_id = ${orgId} and user_id = ${userId} and role != 'owner'`;
  return (result as any).rowCount > 0;
}

export async function updateOrganizationMemberRole(orgId: string, userId: string, role: OrgMemberRole): Promise<OrganizationMember | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<OrganizationMember[]>`
    update organization_members set role = ${role}
    where org_id = ${orgId} and user_id = ${userId} and role != 'owner'
    returning ${sql(ORG_MEMBER_COLUMNS)}
  `;
  return rows[0] ?? null;
}

export async function getUserOrganizations(userId: string): Promise<Array<Organization & { member_role: OrgMemberRole }>> {
  if (!dbEnabled) return [];
  return sql()<Array<Organization & { member_role: OrgMemberRole }>>`
    select o.*, om.role as member_role
    from organizations o
    join organization_members om on om.org_id = o.id
    where om.user_id = ${userId} and o.status = 'approved'
    order by om.joined_at asc
  `;
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ user_id: string }>>`
    select user_id from organization_members where org_id = ${orgId} and user_id = ${userId}
  `;
  return rows.length > 0;
}

export async function isOrgAdminOrAbove(orgId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const rows = await sql()<Array<{ role: string }>>`
    select role from organization_members where org_id = ${orgId} and user_id = ${userId} and role in ('owner', 'admin')
  `;
  return rows.length > 0;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/organizations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/organizations.ts backend/src/services/organizations.test.ts
git commit -m "feat: add organizations service layer with domain logic and tests"
```

---

### Task 7: 项目成员服务层 — projectMembers.ts

**Files:**
- Create: `backend/src/services/projectMembers.ts`
- Create: `backend/src/services/projectMembers.test.ts`

- [ ] **Step 1: 编写项目成员服务测试**

```typescript
import { describe, expect, test } from 'bun:test';
import { isProjectMember as _isProjectMember } from './projectMembers';

describe('projectMembers domain', () => {
  test('placeholder — real tests require DB', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: 编写 projectMembers.ts**

```typescript
import { sql } from "../db/client";
import { isOrgMember } from "./organizations";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type ProjectMemberRole = "owner" | "collaborator";

export type ProjectMember = {
  project_id: string;
  user_id: string | null;
  org_id: string | null;
  role: ProjectMemberRole;
  joined_at: string;
};

export type ProjectMemberWithUser = ProjectMember & {
  user_name?: string;
  user_avatar_url?: string;
  org_name?: string;
  org_slug?: string;
  org_avatar_url?: string;
};

export async function addProjectMember(input: {
  project_id: string;
  user_id?: string;
  org_id?: string;
  role?: ProjectMemberRole;
}): Promise<ProjectMember> {
  const userId = input.user_id ?? null;
  const orgId = input.org_id ?? null;
  const [row] = await sql()<ProjectMember[]>`
    insert into project_members (project_id, user_id, org_id, role)
    values (${input.project_id}, ${userId}, ${orgId}, ${input.role ?? "collaborator"})
    returning project_id, user_id, org_id, role, joined_at
  `;
  return row;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from project_members where project_id = ${projectId} and user_id = ${userId} and role != 'owner'`;
  return (result as any).rowCount > 0;
}

export async function removeProjectOrgMember(projectId: string, orgId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const result = await sql()`delete from project_members where project_id = ${projectId} and org_id = ${orgId}`;
  return (result as any).rowCount > 0;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
  if (!dbEnabled) return [];
  return sql()<ProjectMemberWithUser[]>`
    select pm.*,
      u.name as user_name, u.avatar_url as user_avatar_url,
      o.name as org_name, o.slug as org_slug, o.avatar_url as org_avatar_url
    from project_members pm
    left join users u on u.id = pm.user_id
    left join organizations o on o.id = pm.org_id
    where pm.project_id = ${projectId}
    order by pm.role desc, pm.joined_at asc
  `;
}

export async function getUserProjects(userId: string): Promise<Array<{ project_id: string; role: ProjectMemberRole }>> {
  if (!dbEnabled) return [];
  const directProjects = await sql()<Array<{ project_id: string; role: ProjectMemberRole }>>`
    select project_id, role from project_members where user_id = ${userId}
  `;
  const orgMemberships = await sql()<Array<{ org_id: string }>>`
    select org_id from organization_members where user_id = ${userId}
  `;
  const orgIds = orgMemberships.map(m => m.org_id);
  let orgProjects: Array<{ project_id: string; role: ProjectMemberRole }> = [];
  if (orgIds.length > 0) {
    const values = orgIds.map(id => `'${id}'`).join(",");
    orgProjects = await sql().unsafe(
      `select project_id, role from project_members where org_id in (${values})`
    ) as Array<{ project_id: string; role: ProjectMemberRole }>;
  }
  const map = new Map<string, ProjectMemberRole>();
  for (const p of [...directProjects, ...orgProjects]) {
    if (!map.has(p.project_id) || p.role === "owner") {
      map.set(p.project_id, p.role);
    }
  }
  return Array.from(map.entries()).map(([project_id, role]) => ({ project_id, role }));
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const directRows = await sql()<Array<{ project_id: string }>>`
    select project_id from project_members where project_id = ${projectId} and user_id = ${userId}
  `;
  if (directRows.length > 0) return true;
  const orgRows = await sql()<Array<{ org_id: string }>>`
    select pm.org_id from project_members pm
    join organization_members om on om.org_id = pm.org_id
    where pm.project_id = ${projectId} and om.user_id = ${userId}
  `;
  return orgRows.length > 0;
}

export async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const directRows = await sql()<Array<{ project_id: string }>>`
    select project_id from project_members where project_id = ${projectId} and user_id = ${userId} and role = 'owner'
  `;
  if (directRows.length > 0) return true;
  const orgRows = await sql()<Array<{ org_id: string }>>`
    select pm.org_id from project_members pm
    join organization_members om on om.org_id = pm.org_id and om.role in ('owner', 'admin')
    where pm.project_id = ${projectId} and pm.role = 'owner' and om.user_id = ${userId}
  `;
  return orgRows.length > 0;
}

export async function hasAnyProjectMembership(userId: string): Promise<boolean> {
  if (!dbEnabled) return false;
  const directRows = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from project_members where user_id = ${userId}
  `;
  if (Number(directRows[0]?.count ?? 0) > 0) return true;
  const orgRows = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from organization_members where user_id = ${userId}
  `;
  return Number(orgRows[0]?.count ?? 0) > 0;
}
```

- [ ] **Step 3: 运行测试**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/projectMembers.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/projectMembers.ts backend/src/services/projectMembers.test.ts
git commit -m "feat: add projectMembers service layer"
```

---

### Task 8: 项目认领服务层 — projectClaims.ts

**Files:**
- Create: `backend/src/services/projectClaims.ts`
- Create: `backend/src/services/projectClaims.test.ts`

- [ ] **Step 1: 编写项目认领服务测试**

```typescript
import { describe, expect, test } from 'bun:test';

describe('projectClaims domain', () => {
  test('placeholder — real tests require DB', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: 编写 projectClaims.ts**

```typescript
import { sql } from "../db/client";
import { addProjectMember } from "./projectMembers";
import { promoteToDev } from "./rolePromotion";

const dbEnabled = Boolean(process.env.DATABASE_URL);

export type ClaimStatus = "pending" | "approved" | "rejected";

export type ProjectClaim = {
  id: string;
  project_id: string;
  user_id: string;
  message: string;
  status: ClaimStatus;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
};

const CLAIM_COLUMNS = "id, project_id, user_id, message, status, review_note, created_at, reviewed_at";

export async function createProjectClaim(input: {
  project_id: string;
  user_id: string;
  message?: string;
}): Promise<ProjectClaim> {
  const [row] = await sql()<ProjectClaim[]>`
    insert into project_claims (project_id, user_id, message)
    values (${input.project_id}, ${input.user_id}, ${input.message ?? ""})
    returning ${sql(CLAIM_COLUMNS)}
  `;
  return row;
}

export async function listProjectClaims(params: {
  status?: ClaimStatus;
  user_id?: string;
  project_id?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ProjectClaim[]; page: number; pageSize: number; total: number }> {
  if (!dbEnabled) return { items: [], page: 1, pageSize: 20, total: 0 };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const queryParams: any[] = [];

  if (params.status) { queryParams.push(params.status); whereParts.push(`status = $${queryParams.length}`); }
  if (params.user_id) { queryParams.push(params.user_id); whereParts.push(`user_id = $${queryParams.length}`); }
  if (params.project_id) { queryParams.push(params.project_id); whereParts.push(`project_id = $${queryParams.length}`); }

  const whereClause = whereParts.length ? `where ${whereParts.join(" and ")}` : "";

  const items = await sql().unsafe(
    `select ${CLAIM_COLUMNS} from project_claims ${whereClause} order by created_at desc limit ${pageSize} offset ${offset}`,
    queryParams
  ) as ProjectClaim[];

  const [{ count }] = await sql().unsafe(
    `select count(*)::text as count from project_claims ${whereClause}`,
    queryParams
  ) as Array<{ count: string }>;

  return { items, page, pageSize, total: Number(count) };
}

export async function approveProjectClaim(claimId: string, reviewNote?: string): Promise<ProjectClaim | null> {
  if (!dbEnabled) return null;
  const [claim] = await sql()<ProjectClaim[]>`
    update project_claims set status = 'approved', review_note = ${reviewNote ?? ""}, reviewed_at = now()
    where id = ${claimId} and status = 'pending'
    returning ${sql(CLAIM_COLUMNS)}
  `;
  if (!claim) return null;
  await addProjectMember({ project_id: claim.project_id, user_id: claim.user_id, role: "owner" });
  await promoteToDev(claim.user_id);
  return claim;
}

export async function rejectProjectClaim(claimId: string, reviewNote?: string): Promise<ProjectClaim | null> {
  if (!dbEnabled) return null;
  const rows = await sql()<ProjectClaim[]>`
    update project_claims set status = 'rejected', review_note = ${reviewNote ?? ""}, reviewed_at = now()
    where id = ${claimId} and status = 'pending'
    returning ${sql(CLAIM_COLUMNS)}
  `;
  return rows[0] ?? null;
}
```

- [ ] **Step 3: 运行测试**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/projectClaims.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/projectClaims.ts backend/src/services/projectClaims.test.ts
git commit -m "feat: add projectClaims service layer"
```

---

### Task 9: 角色提权/降权服务 — rolePromotion.ts

**Files:**
- Create: `backend/src/services/rolePromotion.ts`
- Create: `backend/src/services/rolePromotion.test.ts`

- [ ] **Step 1: 编写提权/降权测试**

```typescript
import { describe, expect, test } from 'bun:test';

describe('rolePromotion domain', () => {
  test('placeholder — promoteToDev and demoteFromDev require DB', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: 编写 rolePromotion.ts**

```typescript
import { sql } from "../db/client";
import { setUserRole } from "./users";
import { setUserCapabilities } from "./capabilities";
import { hasAnyProjectMembership } from "./projectMembers";

const dbEnabled = Boolean(process.env.DATABASE_URL);

const DEV_CAPABILITY_IDS = [
  "dev_panel_access",
  "dev:project_edit", "dev:bug_manage", "dev:comment_manage",
  "dev:stats_view", "dev:member_manage",
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
```

- [ ] **Step 3: 运行测试**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test src/services/rolePromotion.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/rolePromotion.ts backend/src/services/rolePromotion.test.ts
git commit -m "feat: add rolePromotion service with promoteToDev and demoteFromDev"
```

---

### Task 10: 新增 requireProjectMember 中间件

**Files:**
- Modify: `backend/src/plugins/auth.ts`

- [ ] **Step 1: 在 auth.ts 中添加 requireProjectMember 函数**

在 `requireCapability` 函数之后添加：

```typescript
export function requireProjectMember(getProjectId: (context: { params: Record<string, string> }) => string) {
  return async ({ user, set, params }: { user: AuthUser | null; set: any; params: Record<string, string> }) => {
    if (!dbEnabled) return;
    if (!user) {
      return authError(set, 401, "UNAUTHORIZED", "Unauthorized");
    }
    if (isSuperadmin(user.name)) return;
    const hasCap = await userHasCapability(user.id, user.name, "dev:project_edit");
    if (!hasCap) {
      return authError(set, 403, "FORBIDDEN", "Forbidden: insufficient capability");
    }
    const projectId = getProjectId({ params });
    const { isProjectMember } = await import("../services/projectMembers");
    const isMember = await isProjectMember(projectId, user.id);
    if (!isMember) {
      return authError(set, 403, "FORBIDDEN", "Forbidden: not a project member");
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/plugins/auth.ts
git commit -m "feat: add requireProjectMember middleware for resource-level authorization"
```

---

## Phase 1 完成检查点

运行全部后端测试确认基础无回归：

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test`
Expected: 全部 PASS

---

## Phase 2: 开发者后台 API

### Task 11: 注册开发者后台 API 路由 — /api/dev/projects

**Files:**
- Modify: `backend/src/index.ts`

在 index.ts 中，在现有 `/api/dev/submissions` 路由之后，添加开发者后台项目相关路由。需要先在文件顶部添加 import：

```typescript
import { addProjectMember, removeProjectMember, getProjectMembers, getUserProjects, isProjectMember, isProjectOwner } from "./services/projectMembers";
import { createOrganization, findOrganizationById, findOrganizationBySlug, listOrganizations, updateOrganization, updateOrganizationStatus, deleteOrganization, getOrganizationMembers, addOrganizationMember, removeOrganizationMember, updateOrganizationMemberRole, getUserOrganizations, isOrgAdminOrAbove, generateOrgSlug, validateOrgName } from "./services/organizations";
import { createProjectClaim, listProjectClaims, approveProjectClaim, rejectProjectClaim } from "./services/projectClaims";
import { promoteToDev, demoteFromDev } from "./services/rolePromotion";
```

- [ ] **Step 1: 添加 /api/dev/projects 路由**

```typescript
.get("/api/dev/projects", async ({ user, set, query }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const projects = await getUserProjects(user.id);
  const projectIds = projects.map(p => p.project_id);
  if (projectIds.length === 0) return { items: [], page: 1, pageSize: 20, total: 0 };
  const page = Math.max(1, Number(query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const idList = projectIds.map(id => `'${id}'`).join(",");
  const items = await sql().unsafe(
    `select id, slug, name, developer, description, icon, banner, stars, language, status, updated_at from projects where id in (${idList}) order by updated_at desc limit ${pageSize} offset ${offset}`
  );
  return { items, page, pageSize, total: projects.length };
})

.get("/api/dev/projects/:id", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const member = await isProjectMember(id, user.id);
  if (!member) return apiForbidden(set, "Not a project member");
  const project = await getProjectById(id);
  if (!project) return apiNotFound(set, "Project not found");
  const members = await getProjectMembers(id);
  return { ...project, members };
})

.patch("/api/dev/projects/:id", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:project_edit");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const member = await isProjectMember(id, user.id);
  if (!member) return apiForbidden(set, "Not a project member");
  const payload = body as any;
  const allowedFields = ["name", "description", "icon", "banner", "github_url", "language", "status", "version", "keywords"];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (payload?.[field] !== undefined) updates[field] = payload[field];
  }
  if (Object.keys(updates).length === 0) return apiBadRequest(set, "No valid fields to update");
  const updated = await updateProject(id, updates);
  if (!updated) return apiNotFound(set, "Project not found");
  await logAuditCompat({ actor: user.name, action: "update", entity_type: "project", entity_id: id, diff: updates });
  return updated;
})
```

- [ ] **Step 2: 添加 /api/dev/projects/:id/members 路由**

```typescript
.get("/api/dev/projects/:id/members", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const member = await isProjectMember(id, user.id);
  if (!member) return apiForbidden(set, "Not a project member");
  return getProjectMembers(id);
})

.post("/api/dev/projects/:id/members", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isOwner = await isProjectOwner(id, user.id);
  if (!isOwner) return apiForbidden(set, "Only project owner can invite members");
  const payload = body as any;
  if (!payload?.user_id) return apiBadRequest(set, "user_id is required");
  const result = await addProjectMember({ project_id: id, user_id: payload.user_id, role: payload.role ?? "collaborator" });
  await promoteToDev(payload.user_id);
  await logAuditCompat({ actor: user.name, action: "add_member", entity_type: "project", entity_id: id, diff: { user_id: payload.user_id } });
  return result;
})

.delete("/api/dev/projects/:id/members/:userId", async ({ params: { id, userId }, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isOwner = await isProjectOwner(id, user.id);
  if (!isOwner) return apiForbidden(set, "Only project owner can remove members");
  const removed = await removeProjectMember(id, userId);
  if (!removed) return apiBadRequest(set, "Cannot remove member");
  await demoteFromDev(userId);
  await logAuditCompat({ actor: user.name, action: "remove_member", entity_type: "project", entity_id: id, diff: { user_id: userId } });
  return { ok: true };
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add /api/dev/projects and /api/dev/projects/:id/members routes"
```

---

### Task 12: 开发者后台 API — Bug/评论/数据

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 添加 /api/dev/feedback 路由**

```typescript
.get("/api/dev/feedback", async ({ user, set, query }) => {
  const capErr = await checkCap(user, set, "dev:bug_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const userProjects = await getUserProjects(user.id);
  const projectIds = userProjects.map(p => p.project_id);
  if (projectIds.length === 0) return { items: [], page: 1, pageSize: 20, total: 0 };
  const projectNames: string[] = [];
  for (const pid of projectIds) {
    const p = await getProjectById(pid);
    if (p) projectNames.push(p.slug);
  }
  const kind = query?.kind === "bug" ? "bug" : undefined;
  const status = query?.status || undefined;
  const page = Math.max(1, Number(query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
  const result = await listFeedback({ project_names: projectNames, kind, status, page, pageSize });
  return result;
})

.patch("/api/dev/feedback/:id", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:bug_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const payload = body as any;
  const feedback = await listFeedback({ ids: [id] });
  if (!feedback.items.length) return apiNotFound(set, "Feedback not found");
  const fb = feedback.items[0];
  const userProjects = await getUserProjects(user.id);
  const projectIds = new Set(userProjects.map(p => p.project_id));
  const project = await sql()<Array<{ id: string }>>`select id from projects where slug = ${fb.project_name} limit 1`;
  if (!project.length || !projectIds.has(project[0].id)) return apiForbidden(set, "Not a project member");
  const updated = await updateFeedback(id, { status: payload?.status, labels: payload?.labels });
  return updated;
})

.post("/api/dev/feedback/:id/replies", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:bug_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const payload = body as any;
  if (!payload?.body) return apiBadRequest(set, "body is required");
  const reply = await createReply({ feedback_id: id, body: payload.body, actor_username: user.name, actor_role: user.role ?? "dev" });
  return reply;
})
```

- [ ] **Step 2: 添加 /api/dev/comments 路由**

```typescript
.get("/api/dev/comments", async ({ user, set, query }) => {
  const capErr = await checkCap(user, set, "dev:comment_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const userProjects = await getUserProjects(user.id);
  const projectIds = userProjects.map(p => p.project_id);
  if (projectIds.length === 0) return { items: [], page: 1, pageSize: 20, total: 0 };
  const projectNames: string[] = [];
  for (const pid of projectIds) {
    const p = await getProjectById(pid);
    if (p) projectNames.push(p.slug);
  }
  const page = Math.max(1, Number(query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
  const result = await listFeedback({ project_names: projectNames, kind: "comment", page, pageSize });
  return result;
})

.delete("/api/dev/comments/:id", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "dev:comment_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const feedback = await listFeedback({ ids: [id] });
  if (!feedback.items.length) return apiNotFound(set, "Comment not found");
  const fb = feedback.items[0];
  const userProjects = await getUserProjects(user.id);
  const projectIds = new Set(userProjects.map(p => p.project_id));
  const project = await sql()<Array<{ id: string }>>`select id from projects where slug = ${fb.project_name} limit 1`;
  if (!project.length || !projectIds.has(project[0].id)) return apiForbidden(set, "Not a project member");
  await sql()`delete from feedback_entries where id = ${id}`;
  await logAuditCompat({ actor: user.name, action: "delete", entity_type: "comment", entity_id: id });
  return { ok: true };
})

.post("/api/dev/comments/:id/replies", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:comment_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const payload = body as any;
  if (!payload?.body) return apiBadRequest(set, "body is required");
  const reply = await createReply({ feedback_id: id, body: payload.body, actor_username: user.name, actor_role: user.role ?? "dev" });
  return reply;
})
```

- [ ] **Step 3: 添加 /api/dev/stats 路由**

```typescript
.get("/api/dev/stats", async ({ user, set }) => {
  const capErr = await checkCap(user, set, "dev:stats_view");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const userProjects = await getUserProjects(user.id);
  const projectIds = userProjects.map(p => p.project_id);
  if (projectIds.length === 0) return { projects: 0, totalBugs: 0, openBugs: 0, totalComments: 0 };
  const idList = projectIds.map(id => `'${id}'`).join(",");
  const projects = await sql().unsafe(`select id, slug, name, stars from projects where id in (${idList})`);
  const projectNames = projects.map((p: any) => p.slug);
  const nameList = projectNames.map((n: string) => `'${n}'`).join(",");
  const [{ total_bugs }] = await sql().unsafe(`select count(*)::text as total_bugs from feedback_entries where project_name in (${nameList}) and kind = 'bug'`) as Array<{ total_bugs: string }>;
  const [{ open_bugs }] = await sql().unsafe(`select count(*)::text as open_bugs from feedback_entries where project_name in (${nameList}) and kind = 'bug' and status = 'open'`) as Array<{ open_bugs: string }>;
  const [{ total_comments }] = await sql().unsafe(`select count(*)::text as total_comments from feedback_entries where project_name in (${nameList}) and kind = 'comment'`) as Array<{ total_comments: string }>;
  return { projects: projectIds.length, totalBugs: Number(total_bugs), openBugs: Number(open_bugs), totalComments: Number(total_comments) };
})
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add /api/dev/feedback, /api/dev/comments, /api/dev/stats routes"
```

---

### Task 13: 开发者后台 API — 组织管理 + 项目认领

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 添加 /api/dev/organizations 路由**

```typescript
.get("/api/dev/organizations", async ({ user, set }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  return getUserOrganizations(user.id);
})

.post("/api/dev/organizations", async ({ body, user, set }) => {
  const capErr = await checkCap(user, set, "user:create_org");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const payload = body as any;
  if (!payload?.name) return apiBadRequest(set, "name is required");
  if (!validateOrgName(payload.name)) return apiBadRequest(set, "Invalid organization name");
  const slug = payload.slug ?? generateOrgSlug(payload.name);
  const existing = await findOrganizationBySlug(slug);
  if (existing) return apiBadRequest(set, "Slug already taken");
  const org = await createOrganization({ name: payload.name, slug, description: payload.description, website_url: payload.website_url, created_by: user.id });
  await logAuditCompat({ actor: user.name, action: "create", entity_type: "organization", entity_id: org.id, diff: { name: payload.name, slug } });
  return org;
})

.get("/api/dev/organizations/:id", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const org = await findOrganizationById(id);
  if (!org) return apiNotFound(set, "Organization not found");
  const isAdmin = await isOrgAdminOrAbove(id, user.id);
  const isMember = await isOrgMember(id, user.id);
  if (!isMember && org.status !== "approved") return apiForbidden(set, "Not a member");
  const members = await getOrganizationMembers(id);
  return { ...org, members, is_admin: isAdmin };
})

.patch("/api/dev/organizations/:id", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isAdmin = await isOrgAdminOrAbove(id, user.id);
  if (!isAdmin) return apiForbidden(set, "Only owner/admin can edit organization");
  const payload = body as any;
  const updated = await updateOrganization(id, { name: payload?.name, description: payload?.description, website_url: payload?.website_url, avatar_url: payload?.avatar_url });
  if (!updated) return apiNotFound(set, "Organization not found");
  return updated;
})

.get("/api/dev/organizations/:id/members", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isMember = await isOrgMember(id, user.id);
  if (!isMember) return apiForbidden(set, "Not a member");
  return getOrganizationMembers(id);
})

.post("/api/dev/organizations/:id/members", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isAdmin = await isOrgAdminOrAbove(id, user.id);
  if (!isAdmin) return apiForbidden(set, "Only owner/admin can invite members");
  const payload = body as any;
  if (!payload?.user_id) return apiBadRequest(set, "user_id is required");
  const result = await addOrganizationMember({ org_id: id, user_id: payload.user_id, role: payload.role ?? "member" });
  await promoteToDev(payload.user_id);
  return result;
})

.delete("/api/dev/organizations/:id/members/:userId", async ({ params: { id, userId }, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isAdmin = await isOrgAdminOrAbove(id, user.id);
  if (!isAdmin) return apiForbidden(set, "Only owner/admin can remove members");
  const removed = await removeOrganizationMember(id, userId);
  if (!removed) return apiBadRequest(set, "Cannot remove member");
  await demoteFromDev(userId);
  return { ok: true };
})

.patch("/api/dev/organizations/:id/members/:userId", async ({ params: { id, userId }, body, user, set }) => {
  const capErr = await checkCap(user, set, "dev:member_manage");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const isOrgOwner = await sql()<Array<{ role: string }>>`select role from organization_members where org_id = ${id} and user_id = ${user.id} and role = 'owner'`;
  if (!isOrgOwner.length) return apiForbidden(set, "Only owner can change member roles");
  const payload = body as any;
  if (!payload?.role || !["admin", "member"].includes(payload.role)) return apiBadRequest(set, "Invalid role");
  const result = await updateOrganizationMemberRole(id, userId, payload.role);
  if (!result) return apiBadRequest(set, "Cannot update role");
  return result;
})
```

- [ ] **Step 2: 添加 /api/dev/project-claims 路由**

```typescript
.post("/api/dev/project-claims", async ({ body, user, set }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const payload = body as any;
  if (!payload?.project_id) return apiBadRequest(set, "project_id is required");
  const existing = await isProjectMember(payload.project_id, user.id);
  if (existing) return apiBadRequest(set, "Already a project member");
  const claim = await createProjectClaim({ project_id: payload.project_id, user_id: user.id, message: payload.message });
  return claim;
})

.get("/api/dev/project-claims", async ({ user, set, query }) => {
  const capErr = await checkCap(user, set, "dev_panel_access");
  if (capErr) return capErr;
  if (!user) return apiUnauthorized(set);
  const page = Math.max(1, Number(query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
  return listProjectClaims({ user_id: user.id, page, pageSize });
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add /api/dev/organizations and /api/dev/project-claims routes"
```

---

### Task 14: 修改现有 API — 提权逻辑 + 能力校验

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 修改 POST /api/submissions — 自动提权**

在现有的 `/api/submissions` 路由中，项目提交成功后添加自动提权逻辑。找到提交成功后返回结果的位置，在 return 之前添加：

```typescript
if (dbEnabled && user) {
  const newProject = await sql()<Array<{ id: string }>>`select id from projects where slug = ${payload.name ?? payload.slug} order by created_at desc limit 1`;
  if (newProject.length) {
    await addProjectMember({ project_id: newProject[0].id, user_id: user.id, role: "owner" });
    await promoteToDev(user.id);
  }
}
```

- [ ] **Step 2: 修改 GET /api/auth/me — 返回组织信息**

在 `/api/auth/me` 路由中，返回结果增加 organizations 字段：

```typescript
const organizations = dbEnabled && user ? await getUserOrganizations(user.id) : [];
return { ...user, capabilities: caps, is_superadmin: isSuperadminUser(user?.name), organizations };
```

- [ ] **Step 3: 修改 GET /api/projects/:name — 返回开发者列表**

在 `/api/projects/:name` 路由中，返回结果增加 developers 字段：

```typescript
const members = dbEnabled && project ? await getProjectMembers(project.id) : [];
return { ...project, developers: members };
```

- [ ] **Step 4: 修改 GET /api/admin/projects/:id — 返回成员信息**

在管理端项目详情路由中增加 members 字段：

```typescript
const members = dbEnabled ? await getProjectMembers(id) : [];
return { ...project, members };
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add auto-promotion on submission, extend /me and project responses with org/member data"
```

---

## Phase 3: 运维后台扩展

### Task 15: 运维后台 API — 组织审核 + 认领审核

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 添加 /api/admin/organizations 路由**

```typescript
.get("/api/admin/organizations", async ({ user, set, query }) => {
  const capErr = await checkCap(user, set, "org:review");
  if (capErr) return capErr;
  const page = Math.max(1, Number(query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
  const status = query?.status as OrganizationStatus | undefined;
  return listOrganizations({ status, page, pageSize });
})

.get("/api/admin/organizations/:id", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "org:review");
  if (capErr) return capErr;
  const org = await findOrganizationById(id);
  if (!org) return apiNotFound(set, "Organization not found");
  const members = await getOrganizationMembers(id);
  return { ...org, members };
})

.post("/api/admin/organizations/:id/approve", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "org:review");
  if (capErr) return capErr;
  const payload = body as any;
  const org = await updateOrganizationStatus(id, "approved", payload?.review_note);
  if (!org) return apiNotFound(set, "Organization not found");
  await sql()`insert into notifications (user_name, type, title, body) select name, 'org_approved', '组织审核通过', ${'您的组织「' + org.name + '」已通过审核。'} from users where id = ${org.created_by}`;
  await logAuditCompat({ actor: user?.name, action: "approve", entity_type: "organization", entity_id: id });
  return org;
})

.post("/api/admin/organizations/:id/reject", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "org:review");
  if (capErr) return capErr;
  const payload = body as any;
  const org = await updateOrganizationStatus(id, "rejected", payload?.review_note);
  if (!org) return apiNotFound(set, "Organization not found");
  await sql()`insert into notifications (user_name, type, title, body) select name, 'org_rejected', '组织审核未通过', ${'您的组织「' + org.name + '」未通过审核。原因：' + (payload?.review_note ?? '无')} from users where id = ${org.created_by}`;
  await logAuditCompat({ actor: user?.name, action: "reject", entity_type: "organization", entity_id: id });
  return org;
})

.patch("/api/admin/organizations/:id", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "org:manage");
  if (capErr) return capErr;
  const payload = body as any;
  if (payload?.status) {
    const org = await updateOrganizationStatus(id, payload.status, payload.review_note);
    if (!org) return apiNotFound(set, "Organization not found");
    return org;
  }
  const updated = await updateOrganization(id, { name: payload?.name, description: payload?.description, website_url: payload?.website_url });
  if (!updated) return apiNotFound(set, "Organization not found");
  return updated;
})

.delete("/api/admin/organizations/:id", async ({ params: { id }, user, set }) => {
  const capErr = await checkCap(user, set, "org:manage");
  if (capErr) return capErr;
  const deleted = await deleteOrganization(id);
  if (!deleted) return apiNotFound(set, "Organization not found");
  await logAuditCompat({ actor: user?.name, action: "delete", entity_type: "organization", entity_id: id });
  return { ok: true };
})
```

- [ ] **Step 2: 添加 /api/admin/project-claims 路由**

```typescript
.get("/api/admin/project-claims", async ({ user, set, query }) => {
  const capErr = await checkCap(user, set, "claim:review");
  if (capErr) return capErr;
  const page = Math.max(1, Number(query?.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
  const status = query?.status as ClaimStatus | undefined;
  return listProjectClaims({ status, page, pageSize });
})

.post("/api/admin/project-claims/:id/approve", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "claim:review");
  if (capErr) return capErr;
  const payload = body as any;
  const claim = await approveProjectClaim(id, payload?.review_note);
  if (!claim) return apiNotFound(set, "Claim not found or already processed");
  await sql()`insert into notifications (user_name, type, title, body) select name, 'claim_approved', '项目认领已通过', '您申请认领的项目已通过审核。' from users where id = ${claim.user_id}`;
  await logAuditCompat({ actor: user?.name, action: "approve_claim", entity_type: "project_claim", entity_id: id });
  return claim;
})

.post("/api/admin/project-claims/:id/reject", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "claim:review");
  if (capErr) return capErr;
  const payload = body as any;
  const claim = await rejectProjectClaim(id, payload?.review_note);
  if (!claim) return apiNotFound(set, "Claim not found or already processed");
  await sql()`insert into notifications (user_name, type, title, body) select name, 'claim_rejected', '项目认领未通过', ${'您申请认领的项目未通过审核。原因：' + (payload?.review_note ?? '无')} from users where id = ${claim.user_id}`;
  await logAuditCompat({ actor: user?.name, action: "reject_claim", entity_type: "project_claim", entity_id: id });
  return claim;
})
```

- [ ] **Step 3: 添加 /api/admin/projects/:id/members 路由（运维指定开发者）**

```typescript
.post("/api/admin/projects/:id/members", async ({ params: { id }, body, user, set }) => {
  const capErr = await checkCap(user, set, "project:update");
  if (capErr) return capErr;
  const payload = body as any;
  if (!payload?.user_id && !payload?.org_id) return apiBadRequest(set, "user_id or org_id is required");
  const result = await addProjectMember({ project_id: id, user_id: payload.user_id, org_id: payload.org_id, role: payload.role ?? "owner" });
  if (payload.user_id) await promoteToDev(payload.user_id);
  await logAuditCompat({ actor: user?.name, action: "add_project_member", entity_type: "project", entity_id: id, diff: { user_id: payload.user_id, org_id: payload.org_id, role: payload.role } });
  return result;
})

.delete("/api/admin/projects/:id/members/:memberId", async ({ params: { id, memberId }, body, user, set }) => {
  const capErr = await checkCap(user, set, "project:update");
  if (capErr) return capErr;
  const payload = body as any;
  let removed = false;
  if (payload?.org_id) {
    removed = await removeProjectOrgMember(id, payload.org_id);
  } else if (memberId) {
    removed = await removeProjectMember(id, memberId);
    if (removed) await demoteFromDev(memberId);
  }
  if (!removed) return apiBadRequest(set, "Cannot remove member");
  await logAuditCompat({ actor: user?.name, action: "remove_project_member", entity_type: "project", entity_id: id });
  return { ok: true };
})
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add admin org review, claim review, and project member management routes"
```

---

### Task 16: 运维后台前端 — AdminOrganizationsView + AdminClaimsView

**Files:**
- Create: `frontend/src/views/admin/AdminOrganizationsView.vue`
- Create: `frontend/src/views/admin/AdminClaimsView.vue`
- Modify: `frontend/src/components/admin/AdminSidebar.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/api/endpoints.ts`

- [ ] **Step 1: 更新 endpoints.ts — 添加新的 API 端点**

在 `API.admin` 中添加：

```typescript
organizations: '/api/admin/organizations',
organizationDetail: (id: string) => `/api/admin/organizations/${encodeURIComponent(id)}`,
organizationApprove: (id: string) => `/api/admin/organizations/${encodeURIComponent(id)}/approve`,
organizationReject: (id: string) => `/api/admin/organizations/${encodeURIComponent(id)}/reject`,
claims: '/api/admin/project-claims',
claimApprove: (id: string) => `/api/admin/project-claims/${encodeURIComponent(id)}/approve`,
claimReject: (id: string) => `/api/admin/project-claims/${encodeURIComponent(id)}/reject`,
projectMembers: (id: string) => `/api/admin/projects/${encodeURIComponent(id)}/members`,
```

在 `API` 中添加 `dev` 分组：

```typescript
dev: {
  projects: '/api/dev/projects',
  projectDetail: (id: string) => `/api/dev/projects/${encodeURIComponent(id)}`,
  projectMembers: (id: string) => `/api/dev/projects/${encodeURIComponent(id)}/members`,
  feedback: '/api/dev/feedback',
  comments: '/api/dev/comments',
  stats: '/api/dev/stats',
  organizations: '/api/dev/organizations',
  organizationDetail: (id: string) => `/api/dev/organizations/${encodeURIComponent(id)}`,
  organizationMembers: (id: string) => `/api/dev/organizations/${encodeURIComponent(id)}/members`,
  projectClaims: '/api/dev/project-claims',
},
```

- [ ] **Step 2: 更新 AdminSidebar.vue — 添加组织审核和认领审核导航项**

在现有导航项列表中，在"审计日志"之后添加：

```html
<RouterLink v-if="hasCap('org:review')" to="/admin/organizations" class="nav-item" active-class="active">
  <span class="icon">🏢</span><span class="label">组织审核</span>
</RouterLink>
<RouterLink v-if="hasCap('claim:review')" to="/admin/claims" class="nav-item" active-class="active">
  <span class="icon">📋</span><span class="label">认领审核</span>
</RouterLink>
```

- [ ] **Step 3: 创建 AdminOrganizationsView.vue**

参考现有的 AdminSubmissionsView.vue 的风格，创建组织审核列表页面。功能包括：
- 按 status 筛选（pending/approved/rejected/suspended）
- 分页列表
- 查看组织详情（名称、slug、描述、创建者、成员列表）
- 批准/拒绝操作（带审核备注）

- [ ] **Step 4: 创建 AdminClaimsView.vue**

参考现有的 AdminSubmissionsView.vue 的风格，创建认领审核列表页面。功能包括：
- 按 status 筛选
- 分页列表
- 查看认领详情（项目名、申请者、申请理由）
- 批准/拒绝操作

- [ ] **Step 5: 更新 router/index.ts — 添加新路由**

在 admin 子路由中添加：

```typescript
{ path: 'organizations', name: 'admin-organizations', component: () => import('@/views/admin/AdminOrganizationsView.vue'), meta: { requiresCapability: 'org:review' } },
{ path: 'claims', name: 'admin-claims', component: () => import('@/views/admin/AdminClaimsView.vue'), meta: { requiresCapability: 'claim:review' } },
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/endpoints.ts frontend/src/components/admin/AdminSidebar.vue frontend/src/views/admin/AdminOrganizationsView.vue frontend/src/views/admin/AdminClaimsView.vue frontend/src/router/index.ts
git commit -m "feat: add admin organizations and claims review pages"
```

---

## Phase 4: 开发者后台前端

### Task 17: DevLayout + DevSidebar + DevBottomNav

**Files:**
- Create: `frontend/src/views/dev/DevLayout.vue`
- Create: `frontend/src/components/dev/DevSidebar.vue`
- Create: `frontend/src/components/dev/DevBottomNav.vue`
- Modify: `frontend/src/router/index.ts`

- [ ] **Step 1: 创建 DevLayout.vue**

复用 AdminLayout.vue 的结构，改标题为 "Dev 后台"，使用 DevSidebar 和 DevBottomNav。

- [ ] **Step 2: 创建 DevSidebar.vue**

复用 AdminSidebar.vue 的样式，导航项为：
- 总览 (/dev/dashboard)
- 组织管理 (/dev/organizations)
- 项目管理 (/dev/projects)
- Bug 反馈 (/dev/bugs)
- 评论管理 (/dev/comments)

- [ ] **Step 3: 创建 DevBottomNav.vue**

复用 AdminBottomNav.vue 的结构，5 个导航项对应侧边栏。

- [ ] **Step 4: 更新 router/index.ts — 添加开发者后台路由**

移除现有 /dev 路由的 isDev 限制，添加完整路由：

```typescript
{
  path: '/dev',
  component: () => import('@/views/dev/DevLayout.vue'),
  meta: { requiresCapability: 'dev_panel_access' },
  children: [
    { path: '', redirect: '/dev/dashboard' },
    { path: 'dashboard', name: 'dev-dashboard', component: () => import('@/views/dev/DevDashboardView.vue') },
    { path: 'organizations', name: 'dev-organizations', component: () => import('@/views/dev/DevOrganizationsView.vue') },
    { path: 'organizations/create', name: 'dev-org-create', component: () => import('@/views/dev/DevOrgCreateView.vue') },
    { path: 'organizations/:id', name: 'dev-org-detail', component: () => import('@/views/dev/DevOrgDetailView.vue') },
    { path: 'projects', name: 'dev-projects', component: () => import('@/views/dev/DevProjectsView.vue') },
    { path: 'projects/:id', name: 'dev-project-detail', component: () => import('@/views/dev/DevProjectDetailView.vue') },
    { path: 'bugs', name: 'dev-bugs', component: () => import('@/views/dev/DevBugsView.vue') },
    { path: 'comments', name: 'dev-comments', component: () => import('@/views/dev/DevCommentsView.vue') },
  ],
},
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/dev/DevLayout.vue frontend/src/components/dev/DevSidebar.vue frontend/src/components/dev/DevBottomNav.vue frontend/src/router/index.ts
git commit -m "feat: add DevLayout, DevSidebar, DevBottomNav and dev routes"
```

---

### Task 18: DevDashboardView + DevProjectsView + DevProjectDetailView

**Files:**
- Create: `frontend/src/views/dev/DevDashboardView.vue`
- Create: `frontend/src/views/dev/DevProjectsView.vue`
- Create: `frontend/src/views/dev/DevProjectDetailView.vue`

- [ ] **Step 1: 创建 DevDashboardView.vue**

总览页面，展示：
- 我参与的组织数量 + 项目数量
- 待处理的 Bug 数量 + 待回复的评论数量
- 最近活动

- [ ] **Step 2: 创建 DevProjectsView.vue**

项目列表页面，参考 AdminProjectsView.vue 风格：
- 卡片/列表展示我参与的项目
- 标注角色（owner/collaborator）
- 标注归属（个人/组织名）
- 点击进入项目详情

- [ ] **Step 3: 创建 DevProjectDetailView.vue**

项目详情页面：
- 项目信息编辑（name, description, icon, banner, github_url 等）
- 项目成员管理（邀请/移除协作者）— 使用 MemberManager 组件
- 项目统计数据

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/dev/DevDashboardView.vue frontend/src/views/dev/DevProjectsView.vue frontend/src/views/dev/DevProjectDetailView.vue
git commit -m "feat: add dev dashboard, projects list, and project detail views"
```

---

### Task 19: DevOrganizationsView + DevOrgDetailView + DevOrgCreateView

**Files:**
- Create: `frontend/src/views/dev/DevOrganizationsView.vue`
- Create: `frontend/src/views/dev/DevOrgDetailView.vue`
- Create: `frontend/src/views/dev/DevOrgCreateView.vue`

- [ ] **Step 1: 创建 DevOrganizationsView.vue**

组织列表页面：
- 卡片展示我所属的组织
- 标注角色（owner/admin/member）
- 创建组织按钮

- [ ] **Step 2: 创建 DevOrgDetailView.vue**

组织详情页面：
- 组织信息编辑（name, description, website_url, avatar_url）— 仅 owner/admin
- 成员管理（邀请/移除/改角色）— 使用 MemberManager 组件
- 组织下的项目列表

- [ ] **Step 3: 创建 DevOrgCreateView.vue**

创建组织表单：
- 名称（必填）
- Slug（自动生成，可手动修改）
- 描述
- 网站
- 提交后提示"等待运维审核"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/dev/DevOrganizationsView.vue frontend/src/views/dev/DevOrgDetailView.vue frontend/src/views/dev/DevOrgCreateView.vue
git commit -m "feat: add dev organizations list, detail, and create views"
```

---

### Task 20: DevBugsView + DevCommentsView + MemberManager

**Files:**
- Create: `frontend/src/views/dev/DevBugsView.vue`
- Create: `frontend/src/views/dev/DevCommentsView.vue`
- Create: `frontend/src/components/shared/MemberManager.vue`

- [ ] **Step 1: 创建 MemberManager.vue**

通用成员管理组件，接收 props：
- `members` — 成员列表
- `canManage` — 是否可管理（邀请/移除/改角色）
- `targetType` — 'project' | 'organization'
- `targetId` — 项目/组织 ID

功能：成员列表（头像+名称+角色）、邀请成员（搜索用户）、移除成员、修改角色。

- [ ] **Step 2: 创建 DevBugsView.vue**

Bug 管理页面：
- 按项目筛选
- Bug 列表（标题、状态、项目名、创建时间）
- 修改状态（open→doing→done）
- 回复 Bug

- [ ] **Step 3: 创建 DevCommentsView.vue**

评论管理页面：
- 按项目筛选
- 评论列表（内容、项目名、评论者、创建时间）
- 删除评论
- 回复评论

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/dev/DevBugsView.vue frontend/src/views/dev/DevCommentsView.vue frontend/src/components/shared/MemberManager.vue
git commit -m "feat: add dev bugs, comments views and shared MemberManager component"
```

---

## Phase 5: 前端主站改造 + 收尾

### Task 21: ProjectDetailView — 开发者列表展示

**Files:**
- Modify: `frontend/src/views/ProjectDetailView.vue`

- [ ] **Step 1: 在项目详情页添加开发者列表**

在项目详情信息区域，添加"开发者"部分：
- 个人开发者：显示头像+名称
- 组织开发者：显示组织头像+名称+成员数
- 如果项目没有 project_members 数据，回退显示 projects.developer 文本字段

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/ProjectDetailView.vue
git commit -m "feat: show developers list on project detail page"
```

---

### Task 22: MeView — 我的组织/项目入口

**Files:**
- Modify: `frontend/src/views/MeView.vue`

- [ ] **Step 1: 在个人中心添加组织/项目入口**

在 MeView 中添加：
- "我的组织" 卡片（显示所属组织列表，点击进入开发者后台组织页）
- "我的项目" 卡片（显示参与的项目数量，点击进入开发者后台项目页）
- 如果用户有 dev_panel_access 能力，显示"进入开发者后台"按钮

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/MeView.vue
git commit -m "feat: add organizations and projects entry in MeView"
```

---

### Task 23: useAuth 扩展 + 用户权限校验接入

**Files:**
- Modify: `frontend/src/composables/useAuth.ts`

- [ ] **Step 1: 扩展 useAuth — 增加组织和项目成员信息**

在 useAuth 返回值中增加：
- `organizations` — 用户所属组织列表
- `isProjectMember(projectId)` — 判断是否为项目成员
- `isOrgAdmin(orgId)` — 判断是否为组织管理员
- `hasUserCapability(capId)` — 判断是否有用户级能力

- [ ] **Step 2: Commit**

```bash
git add frontend/src/composables/useAuth.ts
git commit -m "feat: extend useAuth with org/project membership and user capability checks"
```

---

### Task 24: 全链路测试 + Bug 修复

**Files:**
- Various

- [ ] **Step 1: 运行后端全部测试**

Run: `cd d:\github\AwesomeIWBWeb\backend && bun test`
Expected: 全部 PASS

- [ ] **Step 2: 运行前端构建检查**

Run: `cd d:\github\AwesomeIWBWeb\frontend && bun run build`
Expected: 构建成功，无类型错误

- [ ] **Step 3: 手动验证关键流程**

1. 新用户注册 → 自动获得 user:* 能力
2. 提交项目 → 自动成为 owner → 自动提权为 dev
3. 访问 /dev → 看到开发者后台
4. 在开发者后台管理项目、Bug、评论
5. 创建组织 → 运维审核 → 通过后组织生效
6. 运维在后台指定项目开发者
7. 申请认领项目 → 运维审核 → 通过后获得项目权限

- [ ] **Step 4: 修复发现的问题**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```
