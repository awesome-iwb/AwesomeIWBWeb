#!/bin/bash
# Usage: bash /opt/awesomeiwb/backups/rollback-last.sh
# Restores backend + dist from LATEST_ROLLBACK.txt; restarts backend. Does not touch OpenResty config or postgres volumes.

set -euo pipefail
ROLLBACK_FILE="/opt/awesomeiwb/backups/LATEST_ROLLBACK.txt"
DEPLOY_DIR="/opt/awesomeiwb/deploy"
BACKEND_DIR="/opt/awesomeiwb/backend"
DIST_DIR="/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist"

if [[ ! -f "$ROLLBACK_FILE" ]]; then
  echo "Missing $ROLLBACK_FILE" >&2
  exit 1
fi

LINE=$(grep -v '^#' "$ROLLBACK_FILE" | tail -1)
IFS='|' read -r TS BACKEND_TAR DIST_TAR OLD_IMAGE <<< "$LINE"

echo "Rollback: time=$TS backend=$BACKEND_TAR dist=$DIST_TAR image=${OLD_IMAGE:-none}"

[[ -f "$BACKEND_TAR" ]] || { echo "Missing backend backup" >&2; exit 1; }
[[ -f "$DIST_TAR" ]] || { echo "Missing dist backup" >&2; exit 1; }

tar -xzf "$BACKEND_TAR" -C "$BACKEND_DIR"
rm -rf "$DIST_DIR"/*
tar -xzf "$DIST_TAR" -C "$(dirname "$DIST_DIR")"

cd "$DEPLOY_DIR"
if [[ -n "${OLD_IMAGE:-}" && "$OLD_IMAGE" != "none" ]] && docker image inspect "$OLD_IMAGE" >/dev/null 2>&1; then
  docker tag "$OLD_IMAGE" deploy-backend:rollback
  docker compose up -d backend 2>/dev/null || docker compose up -d
else
  docker compose build backend && docker compose up -d
fi

curl -sS -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health || true
echo
echo "Rollback done"
