# 文章系统协作功能实施计划

## 概述

为现有文章系统新增五大协作功能：冲突保护、版本历史、编辑感知、文章评论、行内批注。
权限模型简化：文章的 `author_user_id` 即为写作者，拥有编辑权限，不新增协作者角色体系。

---

## 一、冲突保护（乐观锁）

### 1.1 数据库迁移

**文件**: `backend/migrations/0038_article_version_lock.sql`

```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
```

### 1.2 后端 — updateArticle 增加版本校验

**文件**: `backend/src/services/articles.ts`

- `updateArticle(id, input)` 签名新增可选参数 `expectedVersion?: number`
- UPDATE 语句加 `WHERE version = ${expectedVersion}`
- 若 affected rows = 0，抛出 `CONFLICT` 错误
- 更新成功时 `SET version = version + 1`
- 返回值包含新 `version`

### 1.3 后端 — PATCH 端点处理冲突

**文件**: `backend/src/index.ts` (PATCH `/api/admin/articles/:id`)

- 从 `body` 中读取 `expectedVersion`
- 调用 `updateArticle(id, { ...input, expectedVersion })`
- 捕获 `CONFLICT` 错误，返回 HTTP 409 + 当前服务端文章数据

### 1.4 前端 — useArticleAutosave 适配乐观锁

**文件**: `frontend/src/composables/useArticleAutosave.ts`

- 新增 `serverVersion: Ref<number>` 状态
- `saveNow()` 提交时带上 `expectedVersion: serverVersion.value`
- 收到 409 响应时：
  - 设置 `saveStatus = 'conflict'`
  - 将服务端返回的最新数据存入 `conflictData`
  - 提示用户"内容已被他人修改"
- 新增 `resolveConflict(strategy: 'overwrite' | 'discard')` 方法
  - overwrite：用本地草稿覆盖，version 用服务端的
  - discard：用服务端数据替换本地草稿

### 1.5 前端 — ArticleEditView 冲突提示 UI

**文件**: `frontend/src/views/admin/ArticleEditView.vue`

- 顶部状态栏新增冲突状态显示
- 冲突时弹出选择面板：覆盖 / 放弃本地修改
- `ArticleDraft` 类型新增 `version: number` 字段

---

## 二、版本历史

### 2.1 数据库迁移

**文件**: `backend/migrations/0038_article_version_lock.sql`（同上文件，合并）

```sql
CREATE TABLE IF NOT EXISTS article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL,
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_revisions_article ON article_revisions (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_revisions_edited_by ON article_revisions (edited_by);
```

`metadata` JSONB 存储快照中的非内容字段（slug, subtitle, category, layout_type, content_format, cover_image, theme, projects, status, sort_index），便于回滚。

### 2.2 后端 — articleRevisions 服务

**文件**: `backend/src/services/articleRevisions.ts`（新建）

参考现有 `revisions.ts` 的模式：

```typescript
// createArticleRevision(articleId: string, editedBy?: string)
//   - 从 articles 表读取当前行
//   - INSERT INTO article_revisions (article_id, title, content, metadata, version, edited_by)
//   - 保留最近 30 条，删除更早的

// listArticleRevisions(articleId: string, params?: { page, pageSize })
//   - 返回 id, title, version, edited_by, created_at
//   - 不返回 content/metadata（列表太重）

// getArticleRevision(revisionId: string)
//   - 返回完整 revision 含 content 和 metadata

// rollbackArticle(articleId: string, revisionId: string)
//   - 读取 revision 的 content + metadata
//   - 更新 articles 表对应字段
//   - version + 1
//   - 创建新 revision 记录回滚操作
```

### 2.3 后端 — updateArticle 集成版本快照

**文件**: `backend/src/services/articles.ts`

- 在 `updateArticle` 成功后，调用 `createArticleRevision(id, editedByUserId)`
- 在 `createArticle` 成功后，同样创建初始 revision

### 2.4 后端 — API 端点

**文件**: `backend/src/index.ts`

```
GET  /api/admin/articles/:id/revisions          → 列出版本历史
GET  /api/admin/articles/:id/revisions/:revId   → 获取某个版本详情
POST /api/admin/articles/:id/revisions/:revId/rollback → 回滚到某版本
```

### 2.5 前端 — 版本历史面板

**文件**: `frontend/src/components/articles/ArticleRevisionPanel.vue`（新建）

- 侧边栏面板，显示版本列表（版本号、编辑者、时间）
- 点击版本可查看该版本内容（只读预览）
- "回滚到此版本"按钮，确认后执行回滚

### 2.6 前端 — 版本差异对比

**文件**: `frontend/src/components/articles/ArticleRevisionDiff.vue`（新建）

- 选择两个版本进行对比
- 使用简单的行级 diff（逐行对比，高亮增删行）
- 不引入外部 diff 库，用纯 JS 实现

### 2.7 前端 — ArticleEditView 集成

**文件**: `frontend/src/views/admin/ArticleEditView.vue`

- 侧边栏新增"版本历史"Tab（与大纲、反向链接并列）
- 引入 `ArticleRevisionPanel` 组件

### 2.8 前端 — API 端点定义

**文件**: `frontend/src/api/endpoints.ts`

```typescript
articleRevisions: (id: string) => `/api/admin/articles/${encodeURIComponent(id)}/revisions`,
articleRevisionDetail: (id: string, revId: string) => `/api/admin/articles/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revId)}`,
articleRevisionRollback: (id: string, revId: string) => `/api/admin/articles/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revId)}/rollback`,
```

---

## 三、编辑感知

### 3.1 数据库迁移

**文件**: `backend/migrations/0039_article_editing_presence.sql`（新建）

```sql
CREATE TABLE IF NOT EXISTS article_editing_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  user_avatar_url TEXT NOT NULL DEFAULT '',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_editing_presence_article ON article_editing_presence (article_id, last_heartbeat DESC);
```

### 3.2 后端 — articlePresence 服务

**文件**: `backend/src/services/articlePresence.ts`（新建）

```typescript
// heartbeat(articleId, userId, userName, userAvatarUrl)
//   - UPSERT INTO article_editing_presence
//   - SET last_heartbeat = now()

// getActiveEditors(articleId, staleSeconds = 60)
//   - SELECT * WHERE article_id AND last_heartbeat > now() - interval '${staleSeconds} seconds'
//   - 返回活跃编辑者列表

// removePresence(articleId, userId)
//   - DELETE WHERE article_id AND user_id

// cleanStalePresence(staleSeconds = 120)
//   - DELETE WHERE last_heartbeat < now() - interval
//   - 可在 heartbeat 时顺便调用
```

### 3.3 后端 — API 端点

**文件**: `backend/src/index.ts`

```
POST   /api/admin/articles/:id/presence/heartbeat  → 心跳上报
DELETE /api/admin/articles/:id/presence             → 离开编辑器时清除
GET    /api/admin/articles/:id/presence             → 获取当前编辑者列表
```

### 3.4 前端 — useArticlePresence composable

**文件**: `frontend/src/composables/useArticlePresence.ts`（新建）

```typescript
// useArticlePresence(articleId: Ref<string>)
//   - 内部定时器每 15 秒发送 heartbeat
//   - 每 10 秒轮询 GET presence 获取编辑者列表
//   - 组件卸载时发送 DELETE presence
//   - 返回 { activeEditors, startPresence, stopPresence }
```

### 3.5 前端 — 编辑者头像显示

**文件**: `frontend/src/views/admin/ArticleEditView.vue`

- 顶部状态栏显示当前编辑者头像（排除自己）
- 悬浮显示用户名
- 类似 Google Docs 的协作头像样式

### 3.6 前端 — API 端点定义

**文件**: `frontend/src/api/endpoints.ts`

```typescript
articlePresenceHeartbeat: (id: string) => `/api/admin/articles/${encodeURIComponent(id)}/presence/heartbeat`,
articlePresence: (id: string) => `/api/admin/articles/${encodeURIComponent(id)}/presence`,
```

---

## 四、文章评论

### 4.1 设计决策

文章评论**不**复用 `feedback_entries` 表（该表绑定 `project_name`，语义不匹配）。
新建 `article_comments` 表，但 UI 交互模式参考现有 `CommentPanel.vue`。

### 4.2 数据库迁移

**文件**: `backend/migrations/0040_article_comments.sql`（新建）

```sql
CREATE TABLE IF NOT EXISTS article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES article_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_username TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_comments_parent ON article_comments (parent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_article_comments_author ON article_comments (author_user_id);
```

### 4.3 后端 — articleComments 服务

**文件**: `backend/src/services/articleComments.ts`（新建）

```typescript
// listArticleComments(articleId, params?: { page, pageSize })
//   - 返回顶层评论 + 每条评论的回复数
//   - JOIN users 获取 avatar_url

// listArticleCommentReplies(commentId, params?)
//   - 返回某条评论的回复列表

// createArticleComment(input: { article_id, parent_id?, body, author_user_id, author_username, author_role })
//   - 创建评论

// updateArticleComment(id, input: { body? })
//   - 仅作者可编辑

// deleteArticleComment(id, userId, isAdmin: boolean)
//   - 作者或管理员可删除
```

### 4.4 后端 — API 端点

**文件**: `backend/src/index.ts`

```
GET    /api/articles/:slug/comments                → 公开：获取文章评论
POST   /api/articles/:slug/comments                → 登录用户：发表评论
PATCH  /api/admin/article-comments/:id             → 作者编辑评论
DELETE /api/admin/article-comments/:id             → 作者/管理员删除评论
GET    /api/article-comments/:id/replies           → 获取评论回复
POST   /api/article-comments/:id/replies           → 回复评论
```

### 4.5 前端 — ArticleCommentPanel 组件

**文件**: `frontend/src/components/articles/ArticleCommentPanel.vue`（新建）

参考现有 `CommentPanel.vue` 的 UI 模式，但简化（无 bug/issue 功能，纯评论）：

- 评论列表（Markdown 渲染）
- 回复功能（嵌套展示）
- 发表评论（Markdown 输入 + 图片上传）
- 编辑/删除自己的评论
- 分页加载

### 4.6 前端 — 公开文章页集成评论

**文件**: `frontend/src/views/ArticleDetailView.vue`

- 文章底部添加 `ArticleCommentPanel`
- 传入 `slug` 作为文章标识

### 4.7 前端 — 编辑器内评论面板

**文件**: `frontend/src/views/admin/ArticleEditView.vue`

- 侧边栏新增"评论"Tab
- 编辑器内也可查看/回复评论

### 4.8 前端 — API 端点定义

**文件**: `frontend/src/api/endpoints.ts`

```typescript
// catalog 域
articleComments: (slug: string) => `/api/articles/${encodeURIComponent(slug)}/comments`,
articleCommentPost: (slug: string) => `/api/articles/${encodeURIComponent(slug)}/comments`,
// admin 域
articleCommentUpdate: (id: string) => `/api/admin/article-comments/${encodeURIComponent(id)}`,
articleCommentDelete: (id: string) => `/api/admin/article-comments/${encodeURIComponent(id)}`,
articleCommentReplies: (id: string) => `/api/article-comments/${encodeURIComponent(id)}/replies`,
articleCommentReply: (id: string) => `/api/article-comments/${encodeURIComponent(id)}/replies`,
```

---

## 五、行内批注

### 5.1 设计决策

行内批注依附于文章内容的特定位置。由于 Markdown 源码没有稳定的行号/字符偏移（编辑后会变），采用**段落锚点**方案：

- 在 Markdown 渲染后的 HTML 中，为每个块级元素（`<h1>`-`<h6>`, `<p>`, `<pre>`, `<ul>`, `<ol>`, `<blockquote>`）自动生成锚点 ID
- 批注关联到锚点 ID + 可选的选区文本
- 渲染时在对应段落旁显示批注标记

### 5.2 数据库迁移

**文件**: `backend/migrations/0041_article_annotations.sql`（新建）

```sql
CREATE TABLE IF NOT EXISTS article_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  anchor_id TEXT NOT NULL DEFAULT '',
  selected_text TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_username TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_annotations_article ON article_annotations (article_id, anchor_id);
CREATE INDEX IF NOT EXISTS idx_article_annotations_author ON article_annotations (author_user_id);
```

### 5.3 后端 — articleAnnotations 服务

**文件**: `backend/src/services/articleAnnotations.ts`（新建）

```typescript
// listArticleAnnotations(articleId, params?: { resolved? })
// createArticleAnnotation(input: { article_id, anchor_id, selected_text, body, author_user_id, author_username, author_role })
// updateArticleAnnotation(id, input: { body?, resolved? })
// deleteArticleAnnotation(id, userId, isAdmin)
```

### 5.4 后端 — API 端点

**文件**: `backend/src/index.ts`

```
GET    /api/admin/articles/:id/annotations            → 列出批注
POST   /api/admin/articles/:id/annotations            → 创建批注
PATCH  /api/admin/article-annotations/:id             → 更新批注（内容/解决状态）
DELETE /api/admin/article-annotations/:id             → 删除批注
```

### 5.5 前端 — 锚点 ID 生成

**文件**: `frontend/src/lib/renderArticleContent.ts`

修改 `renderArticleContent` 函数，在 MarkdownIt 渲染后，为块级元素添加锚点 ID：

- 使用简单的后处理：正则匹配 `<h1>...</h1>`, `<p>...</p>` 等标签
- ID 格式：`p-0`, `p-1`, `p-2`...（按出现顺序递增）
- 或对标题使用 slug 化的 ID（如 `h-introduction`, `h-getting-started`）

### 5.6 前端 — ArticleAnnotationPanel 组件

**文件**: `frontend/src/components/articles/ArticleAnnotationPanel.vue`（新建）

- 侧边栏面板，列出所有批注
- 按锚点分组
- 显示：选区文本引用、批注内容、作者、时间
- 操作：回复（复用评论系统）、标记已解决、删除

### 5.7 前端 — 批注创建交互

**文件**: `frontend/src/views/admin/ArticleEditView.vue`

- 在预览区域，用户选中文本后弹出"添加批注"按钮
- 点击后弹出输入框，提交批注
- 预览区域中，有批注的段落显示高亮标记（左边框或背景色）
- 点击标记跳转到侧边栏对应批注

### 5.8 前端 — API 端点定义

**文件**: `frontend/src/api/endpoints.ts`

```typescript
articleAnnotations: (id: string) => `/api/admin/articles/${encodeURIComponent(id)}/annotations`,
articleAnnotationDetail: (id: string) => `/api/admin/article-annotations/${encodeURIComponent(id)}`,
```

---

## 六、通知扩展

### 6.1 数据库迁移

**文件**: `backend/migrations/0042_notification_types_expand.sql`（新建）

```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'moderation_approved',
    'moderation_rejected',
    'article_edited',
    'article_comment',
    'article_annotation',
    'article_conflict'
  ));
```

### 6.2 后端 — 通知触发点

在以下操作后发送通知：

- 文章被编辑 → 通知作者（如果编辑者不是作者）
- 文章收到评论 → 通知作者
- 文章收到批注 → 通知作者
- 文章编辑冲突 → 通知对方编辑者

### 6.3 前端 — 无需改动

现有通知系统已支持显示和标记已读，只需后端新增 type 即可。

---

## 七、实施顺序

按依赖关系和优先级排序：

| 步骤 | 功能 | 依赖 | 预估工作量 |
|------|------|------|-----------|
| Step 1 | 冲突保护（乐观锁） | 无 | 中 |
| Step 2 | 版本历史 | Step 1 | 中 |
| Step 3 | 编辑感知 | 无 | 中 |
| Step 4 | 文章评论 | 无 | 中 |
| Step 5 | 行内批注 | Step 4 | 大 |
| Step 6 | 通知扩展 | Step 2-5 | 小 |

每个 Step 内部的子步骤顺序：

### Step 1: 冲突保护
1. 创建迁移文件 `0038_article_version_lock.sql`
2. 修改 `articles.ts` — updateArticle 加 version 校验
3. 修改 `index.ts` — PATCH 端点处理 409
4. 修改 `useArticleAutosave.ts` — 适配乐观锁
5. 修改 `ArticleEditView.vue` — 冲突 UI
6. 修改 `ArticleMetadataSheet.vue` — draft 类型加 version

### Step 2: 版本历史
1. 迁移文件中追加 `article_revisions` 表
2. 新建 `articleRevisions.ts` 服务
3. 修改 `articles.ts` — 创建/更新后自动建 revision
4. 修改 `index.ts` — 新增 3 个 API 端点
5. 新建 `ArticleRevisionPanel.vue`
6. 新建 `ArticleRevisionDiff.vue`
7. 修改 `ArticleEditView.vue` — 侧边栏集成
8. 修改 `endpoints.ts` — 新增端点

### Step 3: 编辑感知
1. 创建迁移文件 `0039_article_editing_presence.sql`
2. 新建 `articlePresence.ts` 服务
3. 修改 `index.ts` — 新增 3 个 API 端点
4. 新建 `useArticlePresence.ts` composable
5. 修改 `ArticleEditView.vue` — 编辑者头像显示
6. 修改 `endpoints.ts` — 新增端点

### Step 4: 文章评论
1. 创建迁移文件 `0040_article_comments.sql`
2. 新建 `articleComments.ts` 服务
3. 修改 `index.ts` — 新增 6 个 API 端点
4. 新建 `ArticleCommentPanel.vue`
5. 修改 `ArticleDetailView.vue` — 公开页集成评论
6. 修改 `ArticleEditView.vue` — 编辑器内评论 Tab
7. 修改 `endpoints.ts` — 新增端点

### Step 5: 行内批注
1. 创建迁移文件 `0041_article_annotations.sql`
2. 新建 `articleAnnotations.ts` 服务
3. 修改 `index.ts` — 新增 4 个 API 端点
4. 修改 `renderArticleContent.ts` — 锚点 ID 生成
5. 新建 `ArticleAnnotationPanel.vue`
6. 修改 `ArticleEditView.vue` — 批注交互
7. 修改 `endpoints.ts` — 新增端点

### Step 6: 通知扩展
1. 创建迁移文件 `0042_notification_types_expand.sql`
2. 在 Step 2-5 的各服务中集成通知触发
3. 无前端改动

---

## 八、文件清单汇总

### 新建文件

| 文件 | 说明 |
|------|------|
| `backend/migrations/0038_article_version_lock.sql` | version 字段 + article_revisions 表 |
| `backend/migrations/0039_article_editing_presence.sql` | article_editing_presence 表 |
| `backend/migrations/0040_article_comments.sql` | article_comments 表 |
| `backend/migrations/0041_article_annotations.sql` | article_annotations 表 |
| `backend/migrations/0042_notification_types_expand.sql` | 通知类型扩展 |
| `backend/src/services/articleRevisions.ts` | 版本历史服务 |
| `backend/src/services/articlePresence.ts` | 编辑感知服务 |
| `backend/src/services/articleComments.ts` | 文章评论服务 |
| `backend/src/services/articleAnnotations.ts` | 行内批注服务 |
| `frontend/src/composables/useArticlePresence.ts` | 编辑感知 composable |
| `frontend/src/components/articles/ArticleRevisionPanel.vue` | 版本历史面板 |
| `frontend/src/components/articles/ArticleRevisionDiff.vue` | 版本差异对比 |
| `frontend/src/components/articles/ArticleCommentPanel.vue` | 文章评论面板 |
| `frontend/src/components/articles/ArticleAnnotationPanel.vue` | 行内批注面板 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `backend/src/services/articles.ts` | updateArticle 加 version 校验 + 自动建 revision |
| `backend/src/index.ts` | 新增 ~16 个 API 端点 + PATCH 端点 409 处理 |
| `frontend/src/composables/useArticleAutosave.ts` | 乐观锁适配 + 冲突处理 |
| `frontend/src/views/admin/ArticleEditView.vue` | 集成所有新面板 + 冲突 UI + 编辑者头像 |
| `frontend/src/views/ArticleDetailView.vue` | 集成评论面板 |
| `frontend/src/components/articles/ArticleMetadataSheet.vue` | draft 类型加 version |
| `frontend/src/lib/renderArticleContent.ts` | 块级元素锚点 ID 生成 |
| `frontend/src/api/endpoints.ts` | 新增所有 API 端点定义 |
