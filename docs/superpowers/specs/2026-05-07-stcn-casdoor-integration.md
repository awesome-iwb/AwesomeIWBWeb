# 智教联盟（STCN）Casdoor 登录接入指南

## 概述

本文档描述如何将 Awesome-IWB 网站接入智教联盟（SmartTeachCN，简称 STCN）的统一身份认证系统。

智教联盟使用 **Casdoor** 作为其身份和访问管理（IAM）平台。Casdoor 是一个开源的 UI 优先的 SSO 解决方案，支持 OAuth 2.0、OIDC、SAML 等标准协议。

## 架构流程

```
┌─────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────┐
│  用户   │─────▶│  前端 /me    │─────▶│ 后端 /api   │─────▶│ Casdoor │
│         │      │              │      │ /auth/login │      │  (STCN) │
└─────────┘      └──────────────┘      └─────────────┘      └────┬────┘
     │                                                            │
     │         3. 用户完成登录授权                                 │
     │◀───────────────────────────────────────────────────────────┘
     │
     │         4. Casdoor 重定向到后端 /api/auth/callback
     │         5. 后端换取 token，创建/更新用户，签发 JWT
     │         6. 后端 302 重定向到前端 /me?token=xxx
     │◀───────────────────────────────────────────────────────────
     │
     │         7. 前端存储 JWT，调用 /api/auth/me 获取用户信息
     │         8. 登录完成，跳转至原页面
```

## 已实现的组件

### 后端

| 文件 | 功能 |
|------|------|
| `backend/src/plugins/casdoorAuth.ts` | Casdoor OAuth 插件：/login、/callback、/me、/logout |
| `backend/src/plugins/auth.ts` | 通用认证插件：解析 JWT 和 API Token |
| `backend/src/utils/jwt.ts` | JWT 签名与验证（HS256） |
| `backend/src/services/users.ts` | 用户数据访问层 |
| `backend/migrations/0006_users_and_auth.sql` | 用户表和 API Token 表 |

### 前端

| 文件 | 功能 |
|------|------|
| `frontend/src/views/MeView.vue` | 个人中心：智教联盟登录按钮、回调处理、错误提示 |
| `frontend/src/composables/useAuth.ts` | 认证状态管理：loginWithCasdoor、handleCallback、fetchUser |
| `frontend/src/composables/useApi.ts` | API 请求拦截器（自动附加 Bearer Token） |
| `frontend/src/components/NavBar.vue` | 导航栏：登录状态展示、用户菜单 |

## Casdoor 配置步骤

### 1. 获取 Casdoor 服务器信息

联系智教联盟管理员获取以下信息：

- **Casdoor 服务器地址**：例如 `https://sso.smart-teach.cn`
- **组织名称**：通常为 `stcn`
- **应用名称**：在 Casdoor 中注册的应用名称，例如 `awesome-iwb`
- **Client ID** 和 **Client Secret**：应用凭证

### 2. 在 Casdoor 中注册应用

如果智教联盟允许自助注册应用，按以下步骤操作：

1. 访问 Casdoor 管理后台（通常地址为 `https://sso.smart-teach.cn/login`）
2. 使用管理员账号登录
3. 进入 **Applications** → **Add**
4. 填写应用信息：
   - **Name**: `awesome-iwb`
   - **Display Name**: `Awesome IWB`
   - **Organization**: 选择 `stcn`
   - **Redirect URLs**: 添加以下地址
     - 开发环境：`http://localhost:5173/me`
     - 生产环境：`https://your-domain.com/me`
5. 保存后记录 **Client ID** 和 **Client Secret**

### 3. 配置后端环境变量

复制示例配置文件并填写实际值：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/awesome_iwb
JWT_SECRET=your-random-secret-at-least-32-chars

# Casdoor / STCN 配置
CASDOOR_ENDPOINT=https://sso.smart-teach.cn
CASDOOR_CLIENT_ID=your-client-id-from-casdoor
CASDOOR_CLIENT_SECRET=your-client-secret-from-casdoor
CASDOOR_ORGANIZATION_NAME=stcn
CASDOOR_APPLICATION_NAME=awesome-iwb
CASDOOR_REDIRECT_URI=http://localhost:5173/me
FRONTEND_URL=http://localhost:5173
```

### 4. 运行数据库迁移

```bash
cd backend
bun run src/db/migrate.ts
```

或手动执行：

```bash
psql $DATABASE_URL -f backend/migrations/0006_users_and_auth.sql
```

### 5. 启动服务

**后端**：
```bash
cd backend
bun run dev
```

**前端**：
```bash
cd frontend
npm run dev
```

### 6. 测试登录流程

1. 打开前端页面：`http://localhost:5173`
2. 点击右上角用户头像 → **使用智教联盟登录**
3. 浏览器跳转至 Casdoor 登录页面
4. 输入智教联盟账号密码完成登录
5. 授权应用访问个人信息
6. 自动跳转回 `/me`，显示登录成功

## API 端点

### GET /api/auth/login

获取 Casdoor 授权 URL。

**响应**：
```json
{
  "authorizeUrl": "https://sso.smart-teach.cn/login/oauth/authorize?client_id=xxx&redirect_uri=..."
}
```

### GET /api/auth/callback

Casdoor 回调端点。支持两种模式：

- **浏览器重定向**：返回 302 跳转至前端 `/me?token=xxx`
- **API 调用**：返回 JSON `{ token, user }`

### GET /api/auth/me

获取当前登录用户信息。

**请求头**：`Authorization: Bearer <jwt_token>`

**响应**：
```json
{
  "user": {
    "id": "uuid",
    "name": "用户名",
    "role": "user",
    "avatar_url": "https://...",
    "email": "user@example.com",
    "stcn_user_id": "stcn:xxx"
  }
}
```

### POST /api/auth/logout

退出登录（仅清除前端状态）。

## 故障排除

### "Casdoor not configured" (503)

**原因**：后端未配置 Casdoor 环境变量。

**解决**：检查 `CASDOOR_ENDPOINT` 和 `CASDOOR_CLIENT_ID` 是否已设置。

### "Invalid or expired state" (400)

**原因**：
1. State 参数过期（超过 10 分钟）
2. 用户刷新了回调页面
3. 后端服务重启导致 state 丢失

**解决**：重新点击登录按钮，不要刷新回调页面。

### "Failed to exchange code for token" (400)

**原因**：
1. Client Secret 错误
2. Redirect URI 不匹配（Casdoor 中配置的必须与请求中的完全一致）
3. Authorization Code 已过期（通常 5 分钟内有效）

**解决**：
1. 检查 `.env` 中的 `CASDOOR_CLIENT_SECRET`
2. 确认 `CASDOOR_REDIRECT_URI` 与 Casdoor 后台配置完全一致
3. 重新登录

### 登录后跳转回前端但显示未登录

**原因**：前端未能正确处理 token。

**解决**：
1. 检查浏览器控制台是否有 JavaScript 错误
2. 确认 URL 中是否包含 `?token=xxx` 参数
3. 检查 `useAuth.ts` 中的 `setToken` 是否正确被调用

## 安全注意事项

1. **JWT Secret**：生产环境必须使用强随机字符串，至少 32 字节
2. **Client Secret**：不要提交到 Git 仓库，使用环境变量注入
3. **HTTPS**：生产环境必须使用 HTTPS，防止 token 被截获
4. **State 参数**：已实现 CSRF 防护，state 存储在内存中并 10 分钟过期
5. **Token 存储**：JWT 存储在 localStorage 中，退出时清除

## 相关链接

- [Casdoor 官方文档](https://casdoor.org/docs/overview)
- [智教联盟论坛](https://forum.smart-teach.cn)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
