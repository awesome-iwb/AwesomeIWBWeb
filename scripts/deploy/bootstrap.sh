#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-_}"

APP_USER="${APP_USER:-awesome-iwb}"
INSTALL_DIR="${INSTALL_DIR:-/opt/awesome-iwb}"

DB_MODE="${DB_MODE:-docker}"
DB_NAME="${DB_NAME:-awesome_iwb}"
DB_USER="${DB_USER:-awesome_iwb}"
DB_PASSWORD="${DB_PASSWORD:-awesome_iwb_dev}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

if [[ -z "$REPO_URL" ]]; then
  echo "REPO_URL is required" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (or via sudo)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl git unzip nginx python3

if [[ "$DB_MODE" == "docker" ]]; then
  apt-get install -y docker.io docker-compose-plugin
  systemctl enable --now docker
fi

if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$APP_USER"
fi

if [[ "$DB_MODE" == "docker" ]]; then
  usermod -aG docker "$APP_USER" || true
fi

if ! command -v bun >/dev/null 2>&1; then
  su - "$APP_USER" -c "curl -fsSL https://bun.sh/install | bash"
  if [[ -x "/home/$APP_USER/.bun/bin/bun" ]]; then
    ln -sf "/home/$APP_USER/.bun/bin/bun" /usr/local/bin/bun
  fi
fi

if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  rm -rf "$INSTALL_DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
else
  git -C "$INSTALL_DIR" fetch --all --prune
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" pull --ff-only
fi

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

su - "$APP_USER" -c "cd '$INSTALL_DIR/backend' && bun install --no-progress"
su - "$APP_USER" -c "cd '$INSTALL_DIR/frontend' && bun install --no-progress"

if [[ "$DB_MODE" == "docker" ]]; then
  su - "$APP_USER" -c "cd '$INSTALL_DIR/backend' && docker compose up -d"
  cid="$(cd "$INSTALL_DIR/backend" && docker compose ps -q postgres)"
  for _ in $(seq 1 60); do
    if docker exec "$cid" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

mkdir -p /etc/awesome-iwb
DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
printf "DATABASE_URL=%s\n" "$DATABASE_URL" > /etc/awesome-iwb/backend.env
chmod 600 /etc/awesome-iwb/backend.env

cat > /etc/systemd/system/awesome-iwb-backend.service <<EOF
[Unit]
After=network-online.target
Wants=network-online.target
EOF

if [[ "$DB_MODE" == "docker" ]]; then
  cat >> /etc/systemd/system/awesome-iwb-backend.service <<EOF
After=docker.service
Requires=docker.service
EOF
fi

cat >> /etc/systemd/system/awesome-iwb-backend.service <<EOF

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${INSTALL_DIR}/backend
EnvironmentFile=/etc/awesome-iwb/backend.env
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now awesome-iwb-backend

su - "$APP_USER" -c "cd '$INSTALL_DIR/frontend' && bun run build"

cat > /etc/nginx/sites-available/awesome-iwb.conf <<EOF
server {
  listen 80;
  server_name ${DOMAIN};

  root ${INSTALL_DIR}/frontend/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

rm -f /etc/nginx/sites-enabled/default || true
ln -sf /etc/nginx/sites-available/awesome-iwb.conf /etc/nginx/sites-enabled/awesome-iwb.conf

nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "OK"
echo "backend: systemctl status awesome-iwb-backend --no-pager"
echo "nginx:   systemctl status nginx --no-pager"
echo "url:     http://${DOMAIN}/"

