# Awesome-IWB 网页版 技术架构文档

## 1. 简介
### 1.1 背景
Awesome-IWB 网页版旨在将庞大的 `README.md` 转换并展示为一个现代化的、可交互的、数据驱动的前端静态站点。由于原项目是一个内容展示平台，网页版的核心诉求在于 SEO 友好、快速加载、交互流畅以及低维护成本。

### 1.2 目标
建立一个高性能、高可定制性的前后端分离架构，前端使用 Vue 3 (Vite) 快速搭建交互界面，后端使用基于 Bun 运行时的 Elysia 提供极速 API 服务。

## 2. 系统架构
### 2.1 整体架构图
```mermaid
graph TD
  A[客户端浏览器] -->|HTTP 请求| B[Vite + Vue 3 前端应用]
  A -->|API 请求| C[Bun + Elysia 后端服务]
  C -->|读取/解析数据| D[JSON/YAML 数据源]
  
  subgraph 数据预处理 (运行时/构建时)
    C -->|直接解析或预编译| D
  end
```

### 2.2 核心模块说明
1. **前端 UI 渲染模块**：基于 Vue 3 (Composition API) 构建组件化界面，包含 Hero Section、Navigation、Search Bar、Project Card 等。使用 Vite 作为构建工具。
2. **后端 API 服务模块**：基于 Bun + Elysia 构建的轻量级后端，负责将原始数据（如 YAML、Markdown AST 或预编译的 JSON）组装后提供给前端调用，支持高并发和极低延迟。
3. **状态管理与过滤模块**：前端通过 API 获取数据后，处理用户的搜索输入、分类切换和标签过滤，利用 Vue 的响应式系统 (ref/computed) 实现。

## 3. 技术栈选择
- **前端框架**：Vue 3 (Composition API, script setup) + Vite
  - **原因**：Vite 提供了极速的冷启动和 HMR；Vue 3 提供了清晰的响应式模型，适合快速开发交互丰富的界面。
- **后端框架**：ElysiaJS 运行在 Bun
  - **原因**：Bun 提供了极致的 JavaScript/TypeScript 执行性能和内建的开发体验；Elysia 是专为 Bun 设计的极其快速、人体工程学优秀的 Web 框架。
- **UI 组件库/样式方案**：Tailwind CSS + Vue-specific 动画库 (如 @vueuse/motion) / Lucide Vue
  - **原因**：Tailwind CSS 提供高度定制的实用类，配合 Vue 非常高效。
- **部署方案**：
  - 前端：Vercel, Netlify 或 GitHub Pages 构建静态资源。
  - 后端：Docker 化部署至 Fly.io、Render 或传统 VPS。

## 4. 关键实现设计
### 4.1 数据结构 (API 响应格式)
```json
{
  "categories": [
    {
      "id": "whiteboards",
      "name": "✏️ 屏幕批注与白板软件",
      "description": "替代系统自带臃肿白板...",
      "projects": [
        {
          "name": "Ink Canvas",
          "developer": "WXRIW",
          "status": "停更",
          "recommendation": "🥈",
          "github_url": "https://github.com/WXRIW/Ink-Canvas/",
          "avatar": "https://images.weserv.nl/?url=github.com/WXRIW.png",
          "description": "Ink Canvas 画板是一款轻量级画板软件...",
          "keywords": ["屏幕批注", "白板软件"]
        }
      ]
    }
  ]
}
```

### 4.2 性能与加载优化
- **前端缓存**：通过 Vue 的生命周期钩子请求 API，结合 `fetch` 缓存策略减少重复请求。
- **即时搜索**：利用 computed 属性进行内存级别的列表筛选，保证 0 延迟响应。
- **Elysia 路由**：Elysia 提供基于类型的强力路由和性能，可对输出数据进行直接校验。