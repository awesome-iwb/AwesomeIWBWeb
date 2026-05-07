#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/awesomeiwb"
BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/frontend"
FRONTEND_DIST="/var/www/awesomeiwb/dist"

cd "$APP_ROOT"
git fetch
git reset --hard origin/main

cd "$BACKEND_DIR"
/usr/local/bin/bun install --production
/usr/local/bin/bun run migrate

cd "$FRONTEND_DIR"
/usr/local/bin/bun install
/usr/local/bin/bun run build
rsync -a --delete dist/ "$FRONTEND_DIST/"

systemctl restart awesomeiwb-backend
nginx -t
systemctl reload nginx

echo "update done"
