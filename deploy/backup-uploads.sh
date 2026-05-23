#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${UPLOADS_SOURCE_DIR:-/opt/awesomeiwb/backend/runtime/uploads}"
BACKUP_DIR="${UPLOADS_BACKUP_DIR:-/var/backups/awesomeiwb/uploads}"
RETENTION_DAYS="${UPLOADS_RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/uploads-${STAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "uploads source not found: ${SOURCE_DIR}"
  exit 1
fi

tar -czf "${ARCHIVE}" -C "$(dirname "${SOURCE_DIR}")" "$(basename "${SOURCE_DIR}")"
echo "uploads backup saved: ${ARCHIVE}"

find "${BACKUP_DIR}" -name 'uploads-*.tar.gz' -mtime +"${RETENTION_DAYS}" -delete 2>/dev/null || true
