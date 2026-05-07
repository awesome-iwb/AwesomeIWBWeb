#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "必须使用 root 执行"; exit 1; }

APP_ROOT="/opt/awesomeiwb"
APP_USER="awesomeiwb"
APP_GROUP="awesomeiwb"
BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/frontend"
FRONTEND_DIST_DIR="/var/www/awesomeiwb/dist"
DEPLOY_DIR="$APP_ROOT/deploy"
ENV_DIR="/etc/awesomeiwb"
ENV_FILE="$ENV_DIR/backend.env"
LOG_DIR="/var/log/awesomeiwb"
PG_DATA_DIR="/var/lib/awesomeiwb-pg"
BACKUP_DIR="/var/backups/awesomeiwb"
REPO_URL="${REPO_URL:-}"
SSL_PROVIDER="${SSL_PROVIDER:-none}"
WITH_HTTPS=0
DOMAIN="${DOMAIN:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"

for arg in "$@"; do
  case "$arg" in
    --with-https) WITH_HTTPS=1 ;;
  esac
done

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"

mkdir -p "$APP_ROOT" "$ENV_DIR" "$LOG_DIR" "$PG_DATA_DIR" "$BACKUP_DIR" "/var/www/awesomeiwb" "$FRONTEND_DIST_DIR"
chown -R "$APP_USER:$APP_GROUP" "$LOG_DIR" "$PG_DATA_DIR" "$FRONTEND_DIST_DIR" "$BACKUP_DIR"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx git curl ca-certificates rsync

if systemctl is-active --quiet postgresql; then
  echo "[install] 检测到系统 PostgreSQL 正在运行，停止并禁用以释放 5432 端口（数据库改用 Docker 容器）"
  systemctl stop postgresql
  systemctl disable postgresql
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -x /usr/local/bin/bun ]; then
  curl -fsSL https://bun.sh/install | bash
  cp /root/.bun/bin/bun /usr/local/bin/bun
  chmod +x /usr/local/bin/bun
fi

if [ ! -d "$APP_ROOT/.git" ]; then
  if [ -z "$REPO_URL" ]; then
    echo "缺少仓库：请先 git clone 到 $APP_ROOT，或传入 REPO_URL=<git-url>"
    exit 1
  fi
  git clone "$REPO_URL" "$APP_ROOT"
else
  git -C "$APP_ROOT" pull --ff-only || true
fi

[ -f "$DEPLOY_DIR/.env" ] || { echo "缺少 $DEPLOY_DIR/.env (PG 容器变量)"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "缺少 $ENV_FILE (后端变量)"; exit 1; }
set -a
source "$DEPLOY_DIR/.env"
set +a

docker compose -f "$DEPLOY_DIR/docker-compose.db.yml" up -d

ready=0
for i in {1..60}; do
  if docker exec awesomeiwb-pg pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[ "$ready" -eq 1 ] || { echo "PostgreSQL 未就绪"; exit 1; }

cd "$BACKEND_DIR"
/usr/local/bin/bun install --production
/usr/local/bin/bun run migrate

cd "$FRONTEND_DIR"
/usr/local/bin/bun install
/usr/local/bin/bun run build
rsync -a --delete dist/ "$FRONTEND_DIST_DIR/"

cp "$DEPLOY_DIR/systemd/awesomeiwb-backend.service" /etc/systemd/system/awesomeiwb-backend.service
systemctl daemon-reload
systemctl enable --now awesomeiwb-backend

if [ "$WITH_HTTPS" -eq 1 ]; then
  SSL_CERT_PATH="${SSL_CERT_PATH:-}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-}"
  if [ "$SSL_PROVIDER" = "letsencrypt" ]; then
    if [ -z "$SSL_CERT_PATH" ]; then
      SSL_CERT_PATH="/etc/letsencrypt/live/your-domain.com/fullchain.pem"
      SSL_KEY_PATH="/etc/letsencrypt/live/your-domain.com/privkey.pem"
    fi
    cp "$DEPLOY_DIR/nginx/awesomeiwb-https.conf" /etc/nginx/sites-available/awesomeiwb
  elif [ "$SSL_PROVIDER" = "cloudflare-origin" ]; then
    if [ -z "$SSL_CERT_PATH" ]; then
      SSL_CERT_PATH="/etc/ssl/cloudflare/awesomeiwb-origin.crt"
      SSL_KEY_PATH="/etc/ssl/cloudflare/awesomeiwb-origin.key"
    fi
    cp "$DEPLOY_DIR/nginx/awesomeiwb-https.conf" /etc/nginx/sites-available/awesomeiwb
    [ -x "$DEPLOY_DIR/nginx/refresh-cf-realip.sh" ] && "$DEPLOY_DIR/nginx/refresh-cf-realip.sh"
    [ -f "$SSL_CERT_PATH" ] || { echo "缺少 Cloudflare 证书: $SSL_CERT_PATH"; exit 1; }
    [ -f "$SSL_KEY_PATH" ] || { echo "缺少 Cloudflare 私钥: $SSL_KEY_PATH"; exit 1; }
  else
    echo "SSL_PROVIDER 仅支持 letsencrypt/cloudflare-origin"
    exit 1
  fi
  sed -i "s|__SSL_CERT_PATH__|$SSL_CERT_PATH|g; s|__SSL_KEY_PATH__|$SSL_KEY_PATH|g" /etc/nginx/sites-available/awesomeiwb
  [ -f /etc/nginx/snippets/awesomeiwb-realip.conf ] || printf 'real_ip_header X-Forwarded-For;\n' > /etc/nginx/snippets/awesomeiwb-realip.conf
else
  cp "$DEPLOY_DIR/nginx/awesomeiwb-ip.conf" /etc/nginx/sites-available/awesomeiwb
fi

ln -sf /etc/nginx/sites-available/awesomeiwb /etc/nginx/sites-enabled/awesomeiwb
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [ "$WITH_HTTPS" -eq 1 ] && [ "$SSL_PROVIDER" = "letsencrypt" ]; then
  [ -n "$DOMAIN" ] || { echo "letsencrypt 模式需要 DOMAIN"; exit 1; }
  [ -n "$LETSENCRYPT_EMAIL" ] || { echo "letsencrypt 模式需要 LETSENCRYPT_EMAIL"; exit 1; }
  certbot --nginx -d "$DOMAIN" -m "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive --redirect
fi

echo "安装完成。下一步：1) 用 lincube 首次登录并改密；2) 配置域名/证书；3) 启用 cron 备份。"
