# Awesome IWB: Release Fetching & Vite SSG Migration Design

## 1. 需求背景与目标
Awesome IWB 需要从一个普通的导航列表进化为真正的开源应用生态中心。目前的架构存在两大痛点：
1. **内容滞后**：应用详情页只能看到死板的描述，无法得知该软件最近发布了什么新功能。
2. **SEO 黑洞**：作为一个标准的 Vue 3 SPA，百度、谷歌等爬虫难以抓取其动态生成的内部路由 (`/project/:name`)，导致很难在搜索引擎中曝光。

本方案旨在解决以上两点，通过：
1. 后端自动抓取 GitHub Releases，在前端详情页展示“最近更新了什么（结合最新详情+历史时间线）”。
2. 前端引入 `vite-ssg` 改造，将应用转化为纯静态 HTML，彻底解决 SEO 问题。

## 2. 架构与数据流设计

### 2.1 后端抓取机制 (`update_github_stats.py`)
目前该脚本已在使用 `PyGithub` 抓取基础数据。我们需要：
- 增加 `get_releases()` 的抓取逻辑。
- 对每个项目，抓取最近的 **3~5 个 Release**。
- 提取关键字段：`tag_name` (版本号), `published_at` (发布日期), `body` (更新日志 / Changelog), `html_url`。
- 将这些数据作为一个新的字段 `releases` 数组保存到 `backend/src/data.json` 中的各个项目节点下。
- **Edge Case**：如果项目没有使用 GitHub Release，但使用了 Tag，可以考虑回退抓取最近的 Tag（但不含详细 changelog）；如果什么都没有，则忽略该字段。

### 2.2 前端展示 UI (`ProjectDetailView.vue`)
结合用户的需求，我们将方案一（最新详细内容）与方案二（历史列表）进行结合：
- **位置**：在“About”和“Lineage Graph”之间新增一个 **What's New (最近更新)** 板块。
- **UI 结构**：
  - 顶部显眼位置展示 **最新版本 (Latest Release)**，包含其完整的版本号、相对时间戳（如 "2 days ago"），以及渲染为 Markdown 的 Changelog 文本（可能需要限制高度或做截断，避免过长）。
  - 下方以紧凑的时间线 (Timeline) 形式，列出随后的 2~4 个历史版本号与日期，点击可以直接跳转至 GitHub。
- **Markdown 渲染**：由于 Release notes 是 markdown 格式，我们需要引入 `markdown-it` 或是简单的 Vue 渲染器来正确展示其内容（注意 XSS 风险和样式隔离）。

### 2.3 渲染引擎改造 (`vite-ssg`)
Vite SSG (Static-Site Generation) 将在构建阶段把每个可能的路由预渲染成静态的 `.html` 文件。
- **依赖替换**：将 `vite` 的 `build` 脚本替换为 `vite-ssg build`。将入口文件 `main.ts` 从 `createApp` 改为使用 `ViteSSG` API。
- **路由预提取**：
  - SSG 需要知道有哪些动态路由（`/project/:name`）。我们需要在 `vite.config.ts` 中配置 `ssgOptions.includedRoutes`，让构建脚本在构建时读取后端的 `data.json`，生成所有的合法路径（如 `/project/Ink%20Canvas`），从而为每一个项目生成一个独立的 HTML 文件。
- **Hydration 兼容性**：
  - 由于 ECharts 组件 (`<VChart>`) 极其依赖浏览器 DOM API，我们需要在这些客户端专有组件上使用 `<ClientOnly>` 包裹，防止 SSG 在 Node.js 构建阶段因为找不到 `window` 或 `document` 而报错崩溃。
  - 需要确保目前从 API 动态获取数据的逻辑 (`fetchProjects()`) 在 SSG 环境下能正确处理，或者更优雅的做法是直接在前端构建时把 `data.json` 作为一个静态 import 引入，彻底抛弃运行时的 `/api/projects` 接口，使静态页面的加载速度达到极致。

## 3. 实施步骤
1. **步骤一**：修改 Python 脚本 `backend/src/update_github_stats.py`，增加 Release 数据抓取逻辑，并运行测试，验证 `data.json` 是否成功包含了 `releases` 字段。
2. **步骤二**：在前端安装 `markdown-it` 和 DOM 净化工具，修改 `ProjectDetailView.vue`，实现结合“最新详情展开 + 历史版本时间线”的 UI 组件。
3. **步骤三**：将前端工程的入口与路由改为 Vite SSG 架构，重构数据获取方式为静态导入（不再依赖 Bun 后端），添加 `vite-ssg` 依赖。
4. **步骤四**：配置 SSG 的动态路由提取逻辑，包裹所有客户端专有组件，修复所有的 Hydration 报错。
5. **步骤五**：执行 `npm run build`，验证 `dist/` 目录下是否成功生成了所有应用详情页的独立 `.html` 文件，且其中包含了丰富的 SEO 关键字和更新日志。

## 4. 风险与注意点
- **GitHub API Rate Limit**：抓取 Release 会极大增加 API 请求数（每个项目额外一个请求）。目前仓库大概有 30 个项目，在单次 Actions 运行中不会超过限制，但未来项目增多时需注意使用 GraphQL 优化。
- **Hydration Mismatch**：Vue 3 在 SSG 下如果前端渲染与后端生成的 HTML 树不一致，会导致页面闪烁甚至报错。需要小心处理浏览器特性代码（如 `document.documentElement.classList`）。