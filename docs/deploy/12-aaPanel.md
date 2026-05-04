# aaPanel 部署教程

aaPanel 与宝塔思路类似：面板负责 Nginx/站点/SSL/反代，后端用守护进程。

## 0. 前置条件

- 已安装 aaPanel
- 域名已解析

## 1. 安装组件

在 aaPanel 安装：
- Nginx
- PostgreSQL（若没有插件，建议用 Docker 方式）

## 2. 部署代码

建议目录：`/www/wwwroot/awesome-iwb`

```bash
cd /www/wwwroot
git clone <YOUR_REPO_GIT_URL> awesome-iwb
```

## 3. PostgreSQL

优先参考：`docs/deploy/02-PostgreSQL-部署.md`

你需要拿到最终的：

```text
DATABASE_URL=postgres://awesome_iwb:<PASSWORD>@127.0.0.1:5432/awesome_iwb
```

## 4. 构建前端

```bash
cd /www/wwwroot/awesome-iwb/frontend
bun install --no-progress
bun run build
```

## 5. 创建站点 + SSL

在 aaPanel 新建站点：
- 根目录：`/www/wwwroot/awesome-iwb/frontend/dist`
- SSL：Let’s Encrypt

## 6. 反向代理

添加一条反向代理规则：
- 路径：`/api`
- 目标：`http://127.0.0.1:8080`

## 7. 后端守护

### 1) 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2) 安装依赖

```bash
cd /www/wwwroot/awesome-iwb/backend
bun install --no-progress
```

### 3) 启动方式

推荐用 aaPanel 的守护/PM2（如果面板提供）：
- 工作目录：`/www/wwwroot/awesome-iwb/backend`
- 命令：`/root/.bun/bin/bun run start`
- 环境变量：设置 `DATABASE_URL`

如果 aaPanel 没有合适的守护功能，直接用 systemd，参考：
`docs/deploy/03-Linux-原生部署.md`

