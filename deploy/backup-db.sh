#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/awesomeiwb"
mkdir -p "$BACKUP_DIR"

DB_USER="${POSTGRES_USER:-awesomeiwb}"
DB_NAME="${POSTGRES_DB:-awesomeiwb}"
FILE="$BACKUP_DIR/awesomeiwb-$(date +%F-%H%M).dump"

docker exec awesomeiwb-pg pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$FILE"
find "$BACKUP_DIR" -name "awesomeiwb-*.dump" -mtime +30 -delete
echo "backup saved: $FILE"
