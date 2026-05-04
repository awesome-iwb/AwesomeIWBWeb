# Linux 原生部署（systemd + Nginx，推荐生产）

本方式适合：
- 你希望服务稳定、可控、可审计
- 你希望后端用 systemd 管理，日志用 journalctl
- 你希望 Nginx 承担静态托管 + 反代 `/api`

下文以 Debian/Ubuntu 为例，其他发行版请按等价命令替换。

## 0. 目录规划（建议）

建议把代码放在 `/opt/awesome-iwb`：

```bash
sudo mkdir -p /opt/awesome-iwb
sudo chown -R $USER:$USER /opt/awesome-iwb
```

## 1. 安装依赖

### 1) 基础工具

```bash
sudo apt update
sudo apt install -y git nginx curl ca-certificates
```

### 2) 安装 Bun

按 Bun 官方方式安装到你的用户目录（示例）：

```bash
curl -fsSL https://bun.sh/install | bash
```

确保 `bun` 可用：

```bash
~/.bun/bin/bun -v
```

生产建议把 Bun 固定到某个版本，并在 systemd service 中使用绝对路径。

## 2. 拉取代码

```bash
cd /opt/awesome-iwb
git clone <YOUR_REPO_GIT_URL> .
```

## 3. 部署后端（DB 模式）

### 1) 安装依赖

```bash
cd /opt/awesome-iwb/backend
bun install --no-progress
```

### 2) 配置 DATABASE_URL

参考 `docs/deploy/02-PostgreSQL-部署.md` 完成 PostgreSQL 后，写环境文件：

```bash
sudo mkdir -p /etc/awesome-iwb
sudo tee /etc/awesome-iwb/backend.env >/dev/null <<'EOF'
DATABASE_URL=postgres://awesome_iwb:PLEASE_CHANGE_ME@127.0.0.1:5432/awesome_iwb
EOF
sudo chmod 600 /etc/awesome-iwb/backend.env
```

### 3) 创建 systemd service

`/etc/systemd/system/awesome-iwb-backend.service`

```ini
[Unit]
Description=Awesome IWB Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/awesome-iwb/backend
EnvironmentFile=/etc/awesome-iwb/backend.env
ExecStart=/root/.bun/bin/bun run start
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

注意：
- `ExecStart` 里的 Bun 路径以你的实际安装路径为准（不要照抄）
- 后端默认监听 `8080`，建议只监听本机（当前实现即如此）

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now awesome-iwb-backend
sudo systemctl status awesome-iwb-backend --no-pager
```

日志：

```bash
sudo journalctl -u awesome-iwb-backend -n 200 --no-pager
```

## 4. 部署前端（静态文件）

```bash
cd /opt/awesome-iwb/frontend
bun install --no-progress
bun run build
```

构建输出在：`/opt/awesome-iwb/frontend/dist`

## 5. 配置 Nginx

参考 `docs/deploy/04-Nginx-与-HTTPS.md` 配好站点：
- `/` 静态托管到 `frontend/dist`
- `/api/` 反代到 `http://127.0.0.1:8080`

## 6. 验证

```bash
curl -sS http://127.0.0.1:8080/api/projects | head
curl -I http://127.0.0.1/
```

## 7. 升级（摘要）

完整升级流程见 `docs/deploy/20-运维与升级.md`。

