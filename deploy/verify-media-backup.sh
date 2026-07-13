#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-awesomeiwb-pg}"

if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  echo "usage: $0 /path/to/media-backup-set" >&2
  exit 2
fi

for required in SHA256SUMS database.dump database.toc metadata.env; do
  [[ -s "$BACKUP_DIR/$required" ]] || { echo "backup file missing or empty: $required" >&2; exit 1; }
done

(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$BACKUP_DIR/database.dump" >/dev/null

VERIFY_ROOT="$(mktemp -d)"
cleanup() {
  rm -rf -- "$VERIFY_ROOT"
}
trap cleanup EXIT

for archive in "$BACKUP_DIR"/*.tar.gz; do
  [[ -e "$archive" ]] || continue
  name="$(basename "$archive" .tar.gz)"
  manifest="$BACKUP_DIR/$name.files.sha256"
  [[ -f "$manifest" ]] || { echo "archive manifest missing: $name.files.sha256" >&2; exit 1; }
  gzip -t "$archive"
  tar -tzf "$archive" >/dev/null
  mkdir -p "$VERIFY_ROOT/$name"
  tar -xzf "$archive" -C "$VERIFY_ROOT/$name"
  (cd "$VERIFY_ROOT/$name" && sha256sum -c "$manifest")
done

cleanup
trap - EXIT
echo "backup set verified: $BACKUP_DIR"
