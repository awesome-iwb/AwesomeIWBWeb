# 修复 OpenResty 默认页面和图片加载问题

## 问题分析

### 问题 1：直接访问域名显示 "Welcome to OpenResty"

**根因**：域名 `aiwb.smart-teach.cn` 通过 Cloudflare 代理，Cloudflare 强制 HTTPS（301 重定向）。但服务器 OpenResty 只监听 80 端口，没有配置 SSL/HTTPS。

- 用户访问 `http://aiwb.smart-teach.cn/` → Cloudflare 301 重定向到 `https://aiwb.smart-teach.cn/`
- Cloudflare 回源到服务器 80 端口时，如果 SSL 模式是 "Full" 或 "Full (Strict)"，会尝试用 HTTPS 连接源站
- 服务器没有 443 端口监听 → 连接失败 → Cloudflare 显示默认页面或错误

**解决方案**：在 OpenResty 中添加 HTTPS 支持（使用 Cloudflare Origin 证书或自签名证书），或者将 Cloudflare SSL 模式设为 "Flexible"。

### 问题 2：部分图片加载不出来

**根因**：Cloudflare HTTPS 代理导致混合内容问题。

- 浏览器通过 HTTPS 加载页面
- 页面中的图片 URL 是相对路径（如 `/assets/projects/xxx/icon.webp`）
- 这些请求也会走 HTTPS
- 但服务器没有 HTTPS → 图片请求失败

**另一个可能**：OpenResty 的 `static.conf` 中 `location ~* \.(js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$` 没有包含 `.gif`、`.avif` 等格式，某些图片可能无法正确缓存。

**还有一个可能**：`/images/` 目录下文件不完整。前端代码中 `SiteFooter.vue` 引用了 `/images/stcn.png`，该文件存在。但 `/images/` 下只有 10 个文件，而 `/assets/` 下有完整的项目图片。

## 修复方案

### 方案 A：配置 Cloudflare SSL 模式为 "Flexible"（最简单，无需改服务器）

在 Cloudflare 控制面板中将 SSL 模式设为 "Flexible"：
- Cloudflare 到用户：HTTPS
- Cloudflare 到源站：HTTP
- 这样 Cloudflare 回源时用 HTTP 连接服务器的 80 端口，不需要服务器支持 HTTPS

**缺点**：Cloudflare 到源站之间没有加密，安全性较低

### 方案 B：在 OpenResty 中添加 HTTPS 支持（推荐，更安全）

1. 使用 Cloudflare Origin CA 证书（15年有效期，免费）
2. 在 OpenResty 站点配置中添加 443 监听和 SSL 配置
3. Cloudflare SSL 模式设为 "Full (Strict)"

### 方案 C：使用 1Panel 自动配置 SSL（最方便）

1. 在 1Panel 管理面板中为站点申请 Let's Encrypt 证书
2. 1Panel 自动配置 HTTPS
3. Cloudflare SSL 模式设为 "Full (Strict)"

## 推荐方案

**方案 A（Cloudflare Flexible SSL）** 作为临时修复，**方案 B（Cloudflare Origin CA）** 作为长期方案。

## 实施步骤

### Step 1: 确认 Cloudflare SSL 模式
- 检查当前 Cloudflare SSL/TLS 设置
- 如果是 "Full" 或 "Full (Strict)"，临时改为 "Flexible"

### Step 2: 在 OpenResty 添加 HTTPS 支持
- 生成 Cloudflare Origin CA 证书
- 将证书和私钥放到服务器
- 修改 OpenResty 站点配置添加 443 监听
- 重载 OpenResty

### Step 3: 验证修复
- 测试 HTTPS 访问首页
- 测试图片加载
- 测试 API 健康检查

### Step 4: 清理临时诊断脚本
- 删除 `_check_https.cjs`、`_check_default.cjs`、`_check_ssl.cjs`、`_check_images.cjs`
