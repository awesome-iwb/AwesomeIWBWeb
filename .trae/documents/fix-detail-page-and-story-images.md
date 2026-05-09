# 修复项目详情页加载失败 + 文章图片加载问题

## 问题现状

1. **项目详情页永远卡在加载状态** — 随便点开任何应用，页面只显示加载骨架屏，永远无法加载出内容
2. **Today 文章图片加载不出来** — 故事封面图返回 404（已在上一轮修复了后端 `storyFileAllowlist`，需验证）

## 根因分析

### 问题 1：详情页永远加载中

经过深入代码分析，确认以下可能原因（按可能性排序）：

#### 最可能原因：前端构建过期 + Service Worker 缓存

- 当前部署的前端构建是 5 月 8 日的版本，此后后端已多次修改但**前端从未重新构建部署**
- VitePWA 的 `registerType: 'autoUpdate'` 会缓存旧版本资源，SW 的 `NavigationRoute` 拦截所有导航请求返回缓存的 `index.html`
- 如果旧版 SW 缓存了错误的 API 响应或损坏的 JS bundle，页面将永远无法正常渲染
- **解决方案：重新构建前端并部署，新构建会生成新的 SW 版本号，自动清除旧缓存**

#### 代码 Bug：路由参数双重编码

多个组件在传递路由参数时使用了 `encodeURIComponent`，但 Vue Router 会自动编码 `params`，导致双重编码：

| 文件 | 当前代码 | 问题 |
|------|----------|------|
| [FeaturedView.vue:62](frontend/src/views/FeaturedView.vue#L62) | `encodeURIComponent(projectName)` | 双重编码 |
| [FeaturedView.vue:65](frontend/src/views/FeaturedView.vue#L65) | `encodeURIComponent(projectName)` | 双重编码 |
| [GlobalGraphView.vue:171](frontend/src/views/GlobalGraphView.vue#L171) | `encodeURIComponent(params.data.name)` | 双重编码 |
| [ProjectLineageGraph.vue:184](frontend/src/components/ProjectLineageGraph.vue#L184) | `encodeURIComponent(params.data.name)` | 双重编码 |

正确用法参考（HomeView、HeroCarousel、CommandPalette 已正确）：
```typescript
router.push({ name: 'project-detail', params: { name: projectName } })  // ✅
router.push({ name: 'project-detail', params: { name: encodeURIComponent(projectName) } })  // ❌ 双重编码
```

双重编码导致：项目名含空格时（如 "Ink Canvas"），URL 变成 `/project/Ink%2520Canvas`，API 返回 404，页面显示 "not found" 而非内容。

#### 代码缺陷：`fetchAndSetProject` 缺少 try-finally

[ProjectDetailView.vue:310-369](frontend/src/views/ProjectDetailView.vue#L310-L369) 中 `fetchAndSetProject` 没有用 try-finally 包裹，如果 `useHead()` 抛出异常，`loading.value = false` 永远不会执行，页面永远卡在加载状态。

#### SSG 预渲染只输出骨架屏

`ProjectDetailView` 没有 `onServerPrefetch`，SSG 构建时不会预取数据，预渲染的 HTML 只包含加载骨架屏。如果客户端 JS 执行失败，页面将永远显示骨架屏。

### 问题 2：文章图片 404

**已修复**：上一轮已修改 `backend/src/index.ts` 中的 `storyFileAllowlist`，添加了 `storyImageExtensions` 和 `isStoryImageFile()` 函数，允许图片文件通过故事文件端点提供。已部署到服务器并验证 `cover.webp` 返回 200。

## 修复计划

### Step 1：连接服务器诊断详情页加载问题

- 检查 nginx 访问日志，确认客户端请求是否到达后端
- 检查部署的前端文件是否完整
- 检查 SW 缓存状态
- 检查浏览器端是否有 JS 错误

### Step 2：修复路由参数双重编码

修改 4 处代码，移除 `params` 中多余的 `encodeURIComponent`：

1. **`frontend/src/views/FeaturedView.vue`** (2处)
   - 行 62: `encodeURIComponent(projectName)` → `projectName`
   - 行 65: `encodeURIComponent(projectName)` → `projectName`

2. **`frontend/src/views/GlobalGraphView.vue`** (1处)
   - 行 171: `encodeURIComponent(params.data.name)` → `params.data.name`

3. **`frontend/src/components/ProjectLineageGraph.vue`** (1处)
   - 行 184: `encodeURIComponent(params.data.name)` → `params.data.name`

### Step 3：修复 `fetchAndSetProject` 缺少 try-finally

在 `frontend/src/views/ProjectDetailView.vue` 中，将 `fetchAndSetProject` 函数用 try-finally 包裹，确保 `loading.value = false` 始终执行：

```typescript
const fetchAndSetProject = async () => {
  loading.value = true;
  try {
    const projectName = route.params.name as string;
    project.value = await fetchProjectByName(projectName);
    if (project.value) {
      // useHead(...) 保持不变
    }
  } finally {
    loading.value = false;
  }
};
```

### Step 4：重新构建前端

在本地执行 `bun run build`（即 `vue-tsc -b && vite-ssg build`），生成新的前端构建产物。新构建会：
- 包含所有代码修复
- 生成新的 SW 版本号，自动清除旧缓存
- 重新预渲染所有路由页面

### Step 5：部署到服务器

1. 将 `frontend/dist` 目录上传到服务器
2. 替换 `/var/www/awesomeiwb/` 下的旧文件
3. 重载 nginx（如需要）

### Step 6：验证修复

1. 测试项目详情页是否正常加载
2. 测试 Today 文章图片是否正常显示
3. 测试从不同页面导航到详情页（首页、Today、对比页等）
4. 检查 SW 是否已更新

## 假设与决策

- **假设**：后端 API 正常工作（上一轮已验证 `/api/projects` 和 `/api/projects/:name` 都返回 200）
- **假设**：文章图片 404 已通过后端修复解决，前端无需改动
- **决策**：优先重建前端部署，这是解决"永远加载"最可能的有效手段
- **决策**：同时修复双重编码和 try-finally 缺陷，防止同类问题再次发生
