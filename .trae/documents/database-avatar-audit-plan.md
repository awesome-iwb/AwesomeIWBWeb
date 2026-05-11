# 数据库与头像系统全面排查修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复头像上传不保存/不回传的问题，排查数据库表结构混乱问题，确保数据表设计合理（项目、Bug、评论、账号各一张表）

**Architecture:** 后端 Bun+Elysia，前端 Vue3，数据库 PostgreSQL，头像文件存储在容器内 `/app/runtime/uploads/`，通过 Docker volume 映射到宿主机

**Tech Stack:** Bun, Elysia, PostgreSQL, Docker, Vue3, TypeScript

---

## 现状分析

### 问题 1：头像上传不保存/不回传 🔴 严重

**根因已定位：Docker 容器内路径与 Volume 映射不匹配**

代码逻辑本身是正确的：
- 上传端点 `POST /api/user/avatar` 会将文件写入 `UPLOADS_DIR`（= `/app/runtime/uploads/`）
- 读取端点 `GET /api/uploads/:filename` 从同一目录读取
- 数据库 `updateUserLogin()` 会更新 `avatar_url` 和 `avatar_source`

**但关键问题是：**

1. **Dockerfile 第 12 行** `RUN mkdir -p /app/runtime/uploads` 在构建时创建目录，但容器重启后这个目录是空的（构建时创建的层会被覆盖）
2. **docker-compose.yml 第 39 行** `- /opt/awesomeiwb/backend/runtime:/app/runtime` 映射了宿主机目录到容器内，但**宿主机上 `/opt/awesomeiwb/backend/runtime/` 目录可能不存在或权限不对**
3. **代码第 79-80 行** `await fs.mkdir(UPLOADS_DIR, { recursive: true })` 在启动时创建目录，但如果 volume 映射的宿主机目录权限不对（容器内以 root 运行，但目录可能是 `awesomeiwb` 用户所有），写入会失败
4. **Nginx 没有代理 `/api/uploads/` 路径** — 当前 nginx 配置只代理 `/api/` 前缀到后端，所以 `/api/uploads/xxx` 应该能正常代理。但需要验证。

**验证方法：** 在服务器上检查 `/opt/awesomeiwb/backend/runtime/uploads/` 目录是否存在、权限是否正确、是否有文件

### 问题 2：数据库表结构分析

当前数据库有 **15 张表**：

| 表名 | 用途 | 迁移文件 |
|------|------|----------|
| `schema_migrations` | 迁移版本追踪 | 0001 |
| `categories` | 项目分类 | 0001 |
| `projects` | 项目 | 0001+0002+0004 |
| `audit_logs` | 审计日志 | 0003 |
| `project_revisions` | 项目版本历史 | 0003 |
| `project_submissions` | 项目提交审核 | 0003 |
| `feedback_entries` | 反馈（评论+Bug 合一） | 0005 |
| `feedback_replies` | 反馈回复 | 0010 |
| `users` | 用户/账号 | 0006+0009+0013 |
| `api_tokens` | API 令牌 | 0006 |
| `local_accounts` | 本地管理员账号 | 0007+0008 |
| `comment_moderation` | 评论审核 | 0011 |
| `bug_moderation` | Bug 审核 | 0011 |
| `notifications` | 通知 | 0012 |
| `capabilities` | 权限能力 | 0014 |
| `user_capabilities` | 用户-权限关联 | 0014+0015 |

**用户期望的 4 张核心表：**

| 期望 | 当前状态 | 问题 |
|------|----------|------|
| **项目表** | ✅ `projects` 表存在 | 正常 |
| **Bug 表** | ⚠️ `feedback_entries` 表用 `kind='bug'` 区分，不是独立表 | Bug 和评论混在一张表 |
| **评论表** | ⚠️ `feedback_entries` 表用 `kind='comment'` 区分 | 同上 |
| **账号系统表** | ⚠️ 分散在 `users` + `local_accounts` + `api_tokens` 三张表 | 用户信息分散 |

**具体问题：**

1. **`feedback_entries` 把评论和 Bug 混在一起** — 用 `kind` 字段区分，但 `comment_moderation` 和 `bug_moderation` 是分开的审核表。这导致：
   - 查询 Bug 需要加 `WHERE kind='bug'` 过滤
   - 评论和 Bug 的字段不完全一致（Bug 有 `title`，评论不需要但共享字段）
   - 审核表和反馈表是分开的，关系复杂

2. **`users` 表缺少 `avatar_source` 和 `stcn_username` 列的迁移** — 迁移 0013 添加了这些列，但需要确认服务器上的数据库是否已执行此迁移

3. **`users` 表字段过多** — `stcn_user_id`, `stcn_username`, `sectl_user_id`, `lincube_user_id` 这些平台 ID 直接放在 users 表上，如果将来接入更多平台，需要不断加列

4. **`feedback_entries` 缺少 `user_id` 外键** — 只有 `actor_username` 文本字段，没有关联到 `users` 表，用户改名后关联断裂

5. **`notifications` 用 `user_name` 而非 `user_id`** — 同样存在用户改名后关联断裂的问题

---

## 修复计划

### Task 1: 修复头像上传 — 验证并修复 Docker volume 映射

**Files:**
- Modify: `deploy/docker-compose.yml`
- Verify: 服务器 `/opt/awesomeiwb/backend/runtime/` 目录

- [ ] **Step 1: 在服务器上检查 runtime 目录状态**

```bash
ls -la /opt/awesomeiwb/backend/runtime/
ls -la /opt/awesomeiwb/backend/runtime/uploads/ 2>/dev/null || echo "uploads dir not found"
docker exec awesomeiwb-backend ls -la /app/runtime/uploads/ 2>/dev/null || echo "container uploads dir not found"
```

- [ ] **Step 2: 测试头像上传是否工作**

```bash
# 在容器内测试写入
docker exec awesomeiwb-backend sh -c "echo test > /app/runtime/uploads/test.txt && cat /app/runtime/uploads/test.txt && rm /app/runtime/uploads/test.txt"
```

- [ ] **Step 3: 如果目录权限有问题，修复权限**

```bash
chown -R root:root /opt/awesomeiwb/backend/runtime/
chmod -R 777 /opt/awesomeiwb/backend/runtime/
```

- [ ] **Step 4: 确保 Dockerfile 中创建目录的步骤正确**

当前 Dockerfile 已有 `RUN mkdir -p /app/runtime/uploads /app/logs`，这是正确的。但需要确保容器启动时也有代码创建目录（已有 `await fs.mkdir(UPLOADS_DIR, { recursive: true })`）。

- [ ] **Step 5: 验证 Nginx 代理 `/api/uploads/` 路径**

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/uploads/nonexistent.png
# 应该返回 404（而非 502 或其他错误），说明代理路径正确
```

- [ ] **Step 6: 端到端测试头像上传**

使用 curl 模拟上传：
```bash
curl -X POST -H "Cookie: awesomeiwb_session=VALID_JWT" -F "image=@test.png" http://127.0.0.1:8081/api/user/avatar
```

### Task 2: 检查服务器数据库迁移是否完整

**Files:**
- Verify: 服务器 PostgreSQL 数据库

- [ ] **Step 1: 查询已执行的迁移**

```bash
docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT version FROM schema_migrations ORDER BY version;"
```

- [ ] **Step 2: 查询 users 表结构**

```bash
docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "\d users"
```

- [ ] **Step 3: 查询所有表**

```bash
docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "\dt"
```

- [ ] **Step 4: 如果缺少迁移，手动执行**

如果 `avatar_source` 或 `stcn_username` 列不存在，手动执行迁移 0013：
```bash
docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -f /path/to/0013_user_avatar_source.sql
```

### Task 3: 数据库表结构规范化（评估阶段，不立即执行）

**此任务仅做评估和设计，不修改现有表结构。** 原因：
- 当前系统已上线，有真实数据
- 表结构变更需要数据迁移，风险高
- 需要和用户确认优先级

**评估内容：**

1. **是否需要将 `feedback_entries` 拆分为 `comments` 和 `bugs` 两张独立表？**
   - 优点：查询更清晰，字段更精确
   - 缺点：需要修改所有相关代码和 API，工作量大
   - 替代方案：保持现有结构，添加更好的索引和视图

2. **是否需要将平台 ID 从 `users` 表抽离到 `user_platform_ids` 表？**
   - 优点：扩展性更好
   - 缺点：查询需要 JOIN，增加复杂度

3. **是否需要将 `actor_username` 改为 `user_id` 外键？**
   - 优点：数据完整性
   - 缺点：需要迁移现有数据

### Task 4: 修复前端头像回传逻辑

**Files:**
- Modify: `frontend/src/composables/useAuth.ts`
- Modify: `frontend/src/views/MeView.vue`

- [ ] **Step 1: 检查前端头像 URL 是否正确拼接**

当前 `uploadAvatar` 返回 `/api/uploads/xxx.png`，前端存储到 `avatarUrl` 和 `avatar_url`。需要确认：
- MeView 中 `<img :src="user?.avatarUrl">` 是否正确渲染
- 如果 `avatarUrl` 是相对路径 `/api/uploads/xxx.png`，浏览器会自动拼接当前域名

- [ ] **Step 2: 检查 `fetchUser` 是否正确更新头像**

`fetchUser` 从 `/api/auth/me` 获取用户信息，其中包含 `avatar_url`。需要确认：
- 后端 `/api/auth/me` 返回的 `avatar_url` 是否包含上传后的新路径
- 前端是否在头像上传后调用 `fetchUser()` 刷新

- [ ] **Step 3: 修复 MeView 中头像上传后的刷新逻辑**

上传成功后应该调用 `fetchUser()` 从服务器重新获取用户信息，而不是仅依赖本地 `updateUser()`

---

## 假设与决策

1. **假设**：头像上传代码逻辑本身正确，问题出在 Docker volume 映射或权限
2. **决策**：先修复头像上传的运维问题（Task 1），再做数据库结构评估（Task 3）
3. **决策**：数据库表拆分（评论/Bug 分离）暂不执行，仅做评估，需要用户确认优先级
4. **假设**：服务器上的数据库迁移可能不完整，需要验证

## 验证步骤

1. 头像上传后能在 `/opt/awesomeiwb/backend/runtime/uploads/` 看到文件
2. `GET /api/uploads/{filename}` 返回 200 和图片内容
3. `GET /api/auth/me` 返回的 `avatar_url` 指向正确的上传路径
4. 前端 MeView 页面显示上传的头像
5. 数据库 `users` 表有 `avatar_source` 和 `stcn_username` 列
6. 所有 15 个迁移都已执行
