#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/awesomeiwb"
FRONTEND_DIR="$APP_ROOT/frontend"
COMPOSE_FILE="$APP_ROOT/deploy/docker-compose.yml"
OPENRESTY_CONTAINER="1Panel-openresty-zpMY"
FRONTEND_DIST="/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist"

cd "$APP_ROOT"
TAG="${1:-$(git describe --tags --abbrev=0 HEAD^)}"
git fetch --tags
git checkout "$TAG"

if [[ -f "$APP_ROOT/deploy/prepare-media-storage.sh" ]]; then
  bash "$APP_ROOT/deploy/prepare-media-storage.sh"
else
  echo "prepare-media-storage.sh is not present in $TAG; preserving existing runtime permissions"
fi

if [[ -f "$APP_ROOT/deploy/install-media-ops.sh" ]]; then
  PREPARE_MEDIA_STORAGE=false bash "$APP_ROOT/deploy/install-media-ops.sh"
else
  systemctl disable --now awesomeiwb-media-backup.timer >/dev/null 2>&1 || true
  if [[ -f "$APP_ROOT/deploy/cron.d/awesomeiwb-backup-uploads" ]]; then
    install -m 0644 "$APP_ROOT/deploy/cron.d/awesomeiwb-backup-uploads" /etc/cron.d/awesomeiwb-backup-uploads
  fi
fi

docker compose -f "$COMPOSE_FILE" build backend
docker compose -f "$COMPOSE_FILE" up -d backend

cd "$FRONTEND_DIR"
/usr/local/bin/bun install
/usr/local/bin/bun run build
rsync -a --delete dist/ "$FRONTEND_DIST/"

docker exec "$OPENRESTY_CONTAINER" nginx -t
docker exec "$OPENRESTY_CONTAINER" nginx -s reload

echo "rollback done to $TAG"
