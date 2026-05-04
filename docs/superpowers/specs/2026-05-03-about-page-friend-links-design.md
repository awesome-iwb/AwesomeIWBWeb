# 关于我们页友情链接区 设计文档

## 目标

在“关于我们”页面的“感谢”区块下方新增“友情链接”区块：
- 每条友情链接独占一行（不是一行两个卡片）
- 先添加“智教联盟”一条
- 当前不展示 Logo（站点暂不可访问，无法可靠获取资源）；后续支持将 Logo 保存到本地并展示
- 未来会增加更多友情链接，设计需便于扩展

## 现状

“关于我们”页面实现于：
- [AboutView.vue](file:///workspace/AwesomeIWBWeb/frontend/src/views/AboutView.vue)

当前页面已有区块（按顺序）：
- 运营组
- 贡献者
- 感谢

## 需求细则

### 1) 区块位置与标题
- 位置：紧跟“感谢”区块之后
- 标题：友情链接

### 2) 列表布局（关键）
- 每条友情链接独占一行
- 与页面其它内容保持一致的外层 section 样式（背景、边框、圆角、padding）
- 链接卡片样式可复用当前“贡献者/感谢”区块的卡片基础样式（圆角、border、hover），但容器必须是一列布局

### 3) 单条友情链接内容
每条友情链接展示：
- 名称（例：智教联盟）
- 简介（一句短描述）
- 链接（点击整行打开新窗口）

打开方式：
- `target="_blank"`
- `rel="noopener noreferrer"`

### 4) Logo 策略（当前与未来）
当前阶段：
- 不展示 Logo

未来阶段：
- 当用户提供可直接下载的 logo 直链后，下载并保存到项目本地，例如：
  - `frontend/public/assets/links/<key>.(png|svg|webp)`
- 前端使用本地路径引用（不允许使用外链 URL）

## 数据结构与扩展方案

采用“本地配置文件”方案（非生成脚本），便于后续继续添加更多友情链接：
- 新增 `frontend/src/content/friendLinks.ts`
- 导出 `FriendLink[]`：

```ts
export type FriendLink = {
  key: string;
  name: string;
  href: string;
  description: string;
  logo?: string;
};

export const friendLinks: FriendLink[] = [
  {
    key: "zhijiaolianmeng",
    name: "智教联盟",
    href: "https://forum.smart-teach.cn",
    description: "智教联盟论坛：面向一线电教与教师的交流社区，分享工具、经验与问题解决方案。"
  }
];
```

说明：
- `logo` 字段可选；当前不填
- 后续增加新友情链接仅需往数组追加一条

## 验证标准

- 页面 `/about` 下方出现“友情链接”区块
- 友情链接区块每条一行（手机与桌面端都保持单列）
- 点击“智教联盟”可跳转到 `https://forum.smart-teach.cn`（新窗口）
- 前端 `bun run build` 通过

