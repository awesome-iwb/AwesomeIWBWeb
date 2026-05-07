# AwesomeIWB 权限管理系统设计方案

## 日期
2026-05-07

## 背景
当前 AwesomeIWBWeb 项目的权限系统仅存在于前端：
- 前端有 `user`/`dev`/`ops` 三级角色和路由守卫
- 后端所有 `/api/admin/*` 接口完全开放，无任何认证/授权
- 用户状态通过 localStorage 存储，为演示模式

## 目标
1. 后端所有敏感接口增加认证和授权校验
2. 接入 STCN（智教联盟/Casdoor）第三方登录
3. 建立完整的用户、角色、权限数据模型
4. 保持与现有前端 `useAuth` 的兼容性

## 架构方案：后端代理 Casdoor 登录（方案 B）

### 认证流程

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│  前端   │────▶│  后端 Elysia │────▶│  Casdoor    │────▶│  STCN   │
│         │     │             │     │  (智教联盟)  │     │  IdP    │
└─────────┘     └─────────────┘     └─────────────┘     └─────────┘
     │                │                    │                 │
     │  1. 点击登录    │                    │                 │
     │───────────────▶│                    │                 │
     │                │  2. 生成 state     │                 │
     │                │  返回授权 URL      │                 │
     │◀───────────────│                    │                 │
     │                │                    │                 │
     │  3. 跳转授权页  │                    │                 │
     │────────────────────────────────────▶│                 │
     │                │                    │  4. 用户登录     │
     │                │                    │────────────────▶│
     │                │                    │◀────────────────│
     │                │                    │  5. 回调 code    │
     │                │◀───────────────────│                 │
     │                │  6. 用 code 换 token│                 │
     │                │────────────────────▶│                 │
     │                │◀───────────────────│                 │
     │                │  7. 查询用户信息    │                 │
     │                │────────────────────▶│                 │
     │                │◀───────────────────│                 │
     │                │                    │                 │
     │  8. 返回 JWT   │                    │                 │
     │◀───────────────│                    │                 │
```

### 数据模型

#### 用户表 (users)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casdoor_id TEXT UNIQUE,           -- Casdoor 用户 ID
  name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'dev', 'ops')),
  stcn_user_id TEXT,
  sectl_user_id TEXT,
  lincube_user_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### API Token 表 (api_tokens) - 用于 Admin 等内部账号
```sql
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash
  name TEXT NOT NULL,               -- 令牌名称（如 "admin-cli"）
  role TEXT NOT NULL DEFAULT 'ops' CHECK (role IN ('ops')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 权限中间件设计

#### Elysia 插件结构
```typescript
// plugins/auth.ts
export const authPlugin = new Elysia()
  .derive(({ headers, set }) => {
    // 从 Authorization 头解析 Bearer Token
    // 验证 JWT 签名
    // 返回 { user: { id, name, role } } 或 401
  });

// 使用方式
app.use(authPlugin)
  .get("/api/admin/projects", async ({ user }) => { ... }, {
    beforeHandle: [requireAuth(), requireRole(['ops'])]
  });
```

#### 中间件组合
| 中间件 | 作用 |
|--------|------|
| `requireAuth()` | 必须已登录（JWT 有效） |
| `requireRole(['ops'])` | 必须是 ops 角色 |
| `requireRole(['dev', 'ops'])` | dev 或 ops 均可 |

### 接口权限映射

| 接口 | 所需角色 | 说明 |
|------|----------|------|
| `GET /api/categories` | 无 | 公开 |
| `GET /api/projects` | 无 | 公开 |
| `GET /api/projects/:name` | 无 | 公开 |
| `GET /api/stats` | 无 | 公开 |
| `GET /api/stories` | 无 | 公开 |
| `GET /api/feedback` | 无 | 公开 |
| `POST /api/feedback` | 已登录 | 任何人可提交反馈 |
| `PATCH /api/feedback/:id` | dev/ops | 管理反馈状态 |
| `POST /api/submissions` | 无 | 公开提交 |
| `POST /api/dev/submissions` | 已登录 | 开发者提交变更 |
| `GET /api/admin/*` | ops | 运维后台 |
| `POST /api/admin/*` | ops | 运维后台 |
| `PUT /api/admin/*` | ops | 运维后台 |
| `DELETE /api/admin/*` | ops | 运维后台 |
| `GET /api/admin/submissions` | ops | 审核列表 |
| `POST /api/admin/submissions/:id/approve` | ops | 审核通过 |
| `POST /api/admin/submissions/:id/reject` | ops | 审核驳回 |
| `POST /api/upload` | 已登录 | 上传图片 |

### JWT 设计

- **签发者**: AwesomeIWB Backend
- **有效期**: 7 天
- **Payload**:
  ```json
  {
    "sub": "user-uuid",
    "name": "用户名",
    "role": "dev",
    "iat": 1234567890,
    "exp": 1235172690
  }
  ```
- **签名算法**: HS256（使用 `JWT_SECRET` 环境变量）

### 环境变量

```bash
# 认证
JWT_SECRET=your-super-secret-key-here

# Casdoor / STCN
CASDOOR_ENDPOINT=https://auth.stcn.example.com
CASDOOR_CLIENT_ID=your-client-id
CASDOOR_CLIENT_SECRET=your-client-secret
CASDOOR_ORGANIZATION_NAME=stcn
CASDOOR_APPLICATION_NAME=awesome-iwb
CASDOOR_REDIRECT_URI=http://localhost:5173/api/auth/callback

# 内部 API Token（用于 AdminView 等）
ADMIN_API_TOKEN=aiwb-admin-2026-secure-token
```

### 新增 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/login` | 获取 Casdoor 授权 URL |
| GET | `/api/auth/callback` | Casdoor 回调处理 |
| POST | `/api/auth/logout` | 登出（可选：加入黑名单） |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/refresh` | 刷新 JWT Token |

### 前端适配

1. **useAuth.ts 改造**:
   - `loginDemo` 保留（开发/演示模式）
   - 新增 `loginWithCasdoor()` → 跳转后端 `/api/auth/login`
   - 新增 `fetchUser()` → 调用 `/api/auth/me`
   - Token 存储在 `localStorage` 的 `awesome_iwb_token` 键

2. **请求拦截器**:
   - 所有 API 请求自动附加 `Authorization: Bearer <token>` 头

3. **AdminView 改造**:
   - 密码登录改为 Token 登录（或直接使用 API Token）
   - 调用后端接口时附加 Authorization 头

### 向后兼容

- **JSON 模式**: 当 `DATABASE_URL` 未设置时，权限中间件降级为"允许所有"（保持现有行为）
- **演示模式**: `loginDemo` 保留，但后端会拒绝演示用户的 admin 请求（除非配置了 `DEV_ALLOW_DEMO_ADMIN=true`）

### 实施顺序

1. 数据库迁移（users + api_tokens 表）
2. 后端 JWT 工具函数
3. 后端 auth 插件和中间件
4. 后端 Casdoor 登录流程
5. 后端接口加权限保护
6. 前端 useAuth 改造
7. 前端请求拦截器
8. AdminView 适配
