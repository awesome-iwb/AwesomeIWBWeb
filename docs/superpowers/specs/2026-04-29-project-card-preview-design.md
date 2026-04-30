# 项目卡片悬停预览面板（3D Touch 风格）设计

## 背景与目标

在“应用商场”（首页项目列表卡片网格）中，为项目卡片提供「悬停/长按 → 预览」能力：

- 桌面端：鼠标悬停同一项目卡片约 5 秒后触发
- 移动端：长按触发（默认 700ms）

预览分两种：

- 有 banner：显示一个浮出的预览面板（Teleport 到 body 的 overlay），完整展示 banner
- 无 banner：不弹面板，仅进入“放大态”，信息更易读

非目标：

- 不改变点击进入详情页的主路径
- 不在列表卡片上新增额外按钮（除非后续迭代）

## 现状与落点

首页项目卡片位于 [HomeView.vue](file:///workspace/awesome-iwb/frontend/src/views/HomeView.vue#L523-L645)，已存在：

- 卡片 hover 上浮与光泽效果
- 卡片内 banner 小图（若存在）
- 描述 `line-clamp-2`
- “睿评/评论摘录”区域当前使用 `truncate`

## 交互设计

### 状态机

每个卡片存在 3 个显示状态：

- `idle`：默认态（当前效果）
- `zoom`：放大态（图标/标题变大，描述与睿评展开完整）
- `panel`：预览面板态（仅当项目有 banner 且触发成功时）

### 桌面端（鼠标悬停 5 秒）

触发：

1. `pointerenter` 卡片：
   - 立即进入 `zoom`
   - 启动 `hoverTimer = 5000ms`
2. `hoverTimer` 到期：
   - 若 `project.banner` 存在 → 进入 `panel`
   - 否则保持 `zoom`

取消（任一发生立即回到 `idle` 并清理 timer）：

- `pointerleave` 卡片
- `pointerdown`（用户准备点击）
- 页面滚动/容器滚动（用 scroll 监听，或在 pointermove/scroll 上做取消）
- 路由变化（跳转详情/其他页面）

关闭 `panel`：

- 鼠标离开卡片且离开面板区域（可加 200ms 延迟防抖）
- `Escape`
- 点击遮罩空白处
- 滚动

### 移动端（长按 700ms）

触发：

1. `pointerdown`（touch）：
   - 启动 `longPressTimer = 700ms`
2. `longPressTimer` 到期：
   - 进入 `zoom`
   - 若 `project.banner` 存在 → 进入 `panel`；否则保持 `zoom`

取消：

- `pointerup` / `pointercancel`
- 手指移动超过阈值（建议 10px），避免与滚动冲突

关闭同桌面端（点击遮罩/再次滚动/点击卡片等）

## 视觉与布局

### Zoom（无 banner 或等待计时中）

- 图标容器变大（例如 `w-14 h-14` → `w-18 h-18` 或通过 scale）
- 标题字号变大（例如 `text-lg` → `text-xl`）
- 描述从 `line-clamp-2` 改为完整展示（移除 clamp）
- “睿评/评论摘录”从 `truncate` 改为完整展示（移除 truncate，允许换行）
- 允许卡片高度变高（方案 A）

### Panel（有 banner 才显示）

新增组件：`ProjectPreviewOverlay.vue`

- 使用 `Teleport to="body"`
- `position: fixed`，z-index 高于页面浮层（低于全站 modal 即可）
- 定位：
  - 读取触发卡片 `getBoundingClientRect()`
  - 默认出现在卡片上方居中；如上方空间不足，出现在下方
  - 左右做 clamp，避免出屏
- 内容：
  - 完整 banner（object-cover），大圆角、更强投影
  - 顶部/底部叠加渐变遮罩，展示项目名/开发者/状态（少量文字）
  - 轻微 3D：`transform: translateY(-6px) scale(1.02)`，可加 `perspective` 但避免过度

## 数据与兼容

- 仅前端交互与渲染，不新增后端字段
- 依赖已有 `project.banner` 与卡片数据

## 可访问性与可用性

- `panel` 打开后支持 `Escape` 关闭
- 避免阻断主交互：点击卡片仍然进入详情页（`pointerdown` 触发时应优先取消预览 timer）
- 移动端长按必须设置移动阈值，否则影响滚动体验

## 性能考虑

- 只在触发 `panel` 时渲染 overlay（v-if）
- Hover/长按定时器只保留 1 份“当前激活卡片”的状态，避免同时计时多个卡片
- banner 图片使用现有 URL，不额外预加载（后续可按需做预加载优化）

## 测试/验收清单

- 悬停 5 秒：有 banner → 弹出预览面板；无 banner → 不弹，仅 zoom
- 悬停未满 5 秒移开 → 不弹，回到 idle
- 悬停中滚动页面 → 不弹，回到 idle
- `panel` 展示位置不出屏（顶部不足时自动下方）
- `panel` 鼠标移开关闭、Esc 关闭、点击遮罩关闭
- 移动端长按 700ms 触发；手指移动/滚动不会误触发

