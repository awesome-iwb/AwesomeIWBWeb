# Tasks

- [x] Task 1: 修复后端默认监听端口为 8080
  - [x] SubTask 1.1: 修改 `backend/src/index.ts` 第 1823 行，将 `process.env.PORT ?? 8081` 改为 `process.env.PORT ?? 8080`
  - [x] SubTask 1.2: 修改 `deploy/docker-compose.yml` 中后端服务的 `PORT` 环境变量为 `"8080"`

- [x] Task 2: 添加后端健康检查端点
  - [x] SubTask 2.1: 在 `backend/src/index.ts` 中添加 `/api/health` GET 路由
  - [x] SubTask 2.2: 健康检查返回 `{ status: "ok", db: dbEnabled, timestamp: new Date().toISOString() }`

- [x] Task 3: 修复后端超级管理员判断逻辑
  - [x] SubTask 3.1: 修改 `backend/src/services/capabilities.ts` 第 52 行，`isSuperadmin` 函数添加 `.trim().toLowerCase()` 比较
  - [x] SubTask 3.2: 修改 `backend/src/index.ts` 第 188 行，`checkCap` 函数中对超级管理员的判断确保使用 `user.name`

- [x] Task 4: 改造 AdminView 使用 Session Cookie 认证
  - [x] SubTask 4.1: 移除 AdminView.vue 中的 `isAuthenticated` ref 和 `apiTokenInput`
  - [x] SubTask 4.2: 引入 `useAuth` composable，使用 `isAuthenticated` 和 `hasCapability`
  - [x] SubTask 4.3: 修改 `adminFetch` 函数，移除 `Authorization: Bearer` 头，保留 `credentials: 'include'`
  - [x] SubTask 4.4: 添加未登录状态提示，显示"请先登录"并提供跳转到登录页的按钮
  - [x] SubTask 4.5: 添加权限不足提示，如果已登录但没有 `admin_panel_access` 能力，显示"权限不足"
  - [x] SubTask 4.6: 在 onMounted 中调用 `fetchUser()` 同步登录状态

- [x] Task 5: 修复前端路由守卫
  - [x] SubTask 5.1: 检查 `frontend/src/router/index.ts` 中 `/admin` 路由的守卫逻辑
  - [x] SubTask 5.2: 确保路由守卫使用 `hasCapability('admin_panel_access')` 而非 role 检查
  - [x] SubTask 5.3: 确保未登录用户访问 /admin 时被重定向

- [x] Task 6: 修复 systemd 服务配置
  - [x] SubTask 6.1: 在 `deploy/systemd/awesomeiwb-backend.service` 的 `[Service]` 段添加 `Environment="PORT=8080"`

- [ ] Task 7: 构建并部署
  - [ ] SubTask 7.1: 前端 `npm run build` 确保无错误
  - [ ] SubTask 7.2: 提交代码并推送到仓库
  - [ ] SubTask 7.3: 在服务器上执行更新脚本
  - [ ] SubTask 7.4: 验证 nginx 配置并重载
  - [ ] SubTask 7.5: 验证后端服务状态
  - [ ] SubTask 7.6: 测试网站访问和登录流程

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
- [Task 7] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6]
