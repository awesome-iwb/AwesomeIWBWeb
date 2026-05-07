# AwesomeIWBWeb 上线手册（应用原生 + DB Docker PG16）

> INFO：用户已明确接受服务器维持 `PermitRootLogin yes` + `PasswordAuthentication yes` 的风险，本流程不修改 SSH 配置。

1. SSH 登录服务器（root + 密码，保持现状）。
2. 准备 `/etc/awesomeiwb/backend.env`（可由 `deploy/.env.production.example` 拷贝）。
3. 准备 `/opt/awesomeiwb/deploy/.env`（`POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD`）。
4. 运行 `bash deploy/install.sh`（自动检测并停用系统 PG14 服务，不卸载包）。
5. install 会启动 `postgres:16-alpine` 容器并等待 `pg_isready`。
6. install 会执行后端迁移、前端构建与静态文件同步。
7. install 会部署 `systemd` 与系统 `nginx` 站点并 reload。
8. 首次登录仅 `lincube` 本地口令可用，进入后必须立即改密。
9. 视需要启用 HTTPS：`bash deploy/install.sh --with-https` + `SSL_PROVIDER=letsencrypt|cloudflare-origin`。
10. 启用备份：复制 `deploy/cron.d/awesomeiwb-backup` 至 `/etc/cron.d/`。

## 验收清单

- `systemctl status awesomeiwb-backend`
- `docker ps | rg awesomeiwb-pg`
- `curl -I http://127.0.0.1:8080/api/projects`
- `nginx -t`

## HTTPS 选项

- `SSL_PROVIDER=letsencrypt`：由 `certbot --nginx` 自动签发（需 `DOMAIN` 与 `LETSENCRYPT_EMAIL`）。
- `SSL_PROVIDER=cloudflare-origin`：使用 `/etc/ssl/cloudflare/awesomeiwb-origin.crt|key`，并运行 `deploy/nginx/refresh-cf-realip.sh` 刷新真实源 IP。
- 可选网络收敛：`deploy/lock-to-cloudflare.sh`（默认不启用）。
