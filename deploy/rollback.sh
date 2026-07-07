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

docker compose -f "$COMPOSE_FILE" build backend
docker compose -f "$COMPOSE_FILE" up -d backend

cd "$FRONTEND_DIR"
/usr/local/bin/bun install
/usr/local/bin/bun run build
rsync -a --delete dist/ "$FRONTEND_DIST/"

docker exec "$OPENRESTY_CONTAINER" nginx -t
docker exec "$OPENRESTY_CONTAINER" nginx -s reload

echo "rollback done to $TAG"
