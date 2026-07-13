#!/usr/bin/env bash
set -euo pipefail

umask 077

APP_ROOT="${APP_ROOT:-/opt/awesomeiwb}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-awesomeiwb-pg}"
POSTGRES_USER="${POSTGRES_USER:-awesomeiwb}"
POSTGRES_DB="${POSTGRES_DB:-awesomeiwb}"
BACKUP_ROOT="${MEDIA_BACKUP_ROOT:-/var/backups/awesomeiwb/media-sets}"
REMOTE_ROOT="${MEDIA_BACKUP_REMOTE_DIR:-}"
REQUIRE_REMOTE="${MEDIA_BACKUP_REQUIRE_REMOTE:-false}"
RETENTION_DAYS="${MEDIA_BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_DIR="$BACKUP_ROOT/$STAMP"
PARTIAL_DIR="$BACKUP_ROOT/.${STAMP}.partial"
LOCK_FILE="${MEDIA_BACKUP_LOCK_FILE:-/run/lock/awesomeiwb-media-backup.lock}"
LEGACY_ROOT="${MEDIA_LEGACY_ROOT:-$APP_ROOT/backend/runtime/uploads}"
MEDIA_ROOT="${MEDIA_STORAGE_ROOT:-$APP_ROOT/backend/runtime/media}"
MARKER_PATH="${MEDIA_BACKUP_MARKER:-$MEDIA_ROOT/.backup-last-success}"
MARKER_TMP="${MARKER_PATH}.${STAMP}.partial"

[[ "$BACKUP_ROOT" = /* && "$BACKUP_ROOT" != "/" ]] || { echo "unsafe MEDIA_BACKUP_ROOT: $BACKUP_ROOT" >&2; exit 1; }
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ && "$RETENTION_DAYS" -ge 1 ]] || { echo "invalid MEDIA_BACKUP_RETENTION_DAYS" >&2; exit 1; }

mkdir -p "$BACKUP_ROOT" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "another media backup is already running" >&2; exit 1; }

cleanup() {
  rm -rf -- "$PARTIAL_DIR"
  rm -f -- "$MARKER_TMP"
}
trap cleanup EXIT

[[ -d "$LEGACY_ROOT" ]] || { echo "legacy media root is missing: $LEGACY_ROOT" >&2; exit 1; }
[[ -d "$MEDIA_ROOT" ]] || { echo "v2 media root is missing: $MEDIA_ROOT" >&2; exit 1; }
[[ ! -e "$FINAL_DIR" ]] || { echo "backup destination already exists: $FINAL_DIR" >&2; exit 1; }

mkdir -p "$PARTIAL_DIR"

# Originals are immutable and purge is separately gated. Dumping the database first means
# concurrent new uploads can only appear as harmless extra files in the later archive.
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$PARTIAL_DIR/database.dump"
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$PARTIAL_DIR/database.dump" > "$PARTIAL_DIR/database.toc"

archive_tree() {
  local source="$1"
  local name="$2"
  if [[ -d "$source" ]]; then
    tar -czf "$PARTIAL_DIR/$name.tar.gz" -C "$(dirname "$source")" "$(basename "$source")"
    gzip -t "$PARTIAL_DIR/$name.tar.gz"
    # Build the per-file manifest from the completed archive rather than the
    # live tree. This guarantees the manifest and tarball describe the same
    # point-in-time bytes even if a derivative is created concurrently.
    local verify_root="$PARTIAL_DIR/.verify-$name"
    mkdir -p "$verify_root"
    tar -xzf "$PARTIAL_DIR/$name.tar.gz" -C "$verify_root"
    (
      cd "$verify_root"
      find "$(basename "$source")" -type f -print0 | sort -z | xargs -0 -r sha256sum
    ) > "$PARTIAL_DIR/$name.files.sha256"
    rm -rf -- "$verify_root"
  else
    printf 'absent\n' > "$PARTIAL_DIR/$name.absent"
  fi
}

archive_tree "$LEGACY_ROOT" legacy-uploads
archive_tree "$MEDIA_ROOT" media-v2

docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
  "select json_build_object(
     'media_assets', (select count(*) from media_assets),
     'media_references', (select count(*) from media_references),
     'media_blobs', (select case when to_regclass('public.media_blobs') is null then 0 else count(*) end from media_blobs),
     'captured_at', now()
   );" > "$PARTIAL_DIR/database-counts.json" 2>/dev/null || true

printf 'backup_id=%s\ncreated_at=%s\npostgres_db=%s\n' "$STAMP" "$(date -u +%FT%TZ)" "$POSTGRES_DB" > "$PARTIAL_DIR/metadata.env"
(
  cd "$PARTIAL_DIR"
  find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%P\0' | sort -z | xargs -0 sha256sum > SHA256SUMS
  sha256sum -c SHA256SUMS
)

mv "$PARTIAL_DIR" "$FINAL_DIR"
bash "$APP_ROOT/deploy/verify-media-backup.sh" "$FINAL_DIR"

REMOTE_VERIFIED=false
if [[ -n "$REMOTE_ROOT" ]]; then
  mkdir -p "$REMOTE_ROOT"
  rsync -a --partial "$FINAL_DIR/" "$REMOTE_ROOT/$STAMP/"
  bash "$APP_ROOT/deploy/verify-media-backup.sh" "$REMOTE_ROOT/$STAMP"
  REMOTE_VERIFIED=true
elif [[ "$REQUIRE_REMOTE" == "true" ]]; then
  echo "MEDIA_BACKUP_REQUIRE_REMOTE=true but MEDIA_BACKUP_REMOTE_DIR is empty" >&2
  exit 1
fi

while IFS= read -r -d '' expired; do
  name="$(basename "$expired")"
  [[ "$name" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || continue
  rm -rf -- "$expired"
done < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -print0)
mkdir -p "$(dirname "$MARKER_PATH")"
printf 'version=1\nbackup_id=%s\ncompleted_at_epoch=%s\ncompleted_at=%s\nlocal_verified=true\nremote_verified=%s\n' \
  "$STAMP" "$(date -u +%s)" "$(date -u +%FT%TZ)" "$REMOTE_VERIFIED" > "$MARKER_TMP"
chmod 0644 "$MARKER_TMP"
mv -f -- "$MARKER_TMP" "$MARKER_PATH"
trap - EXIT
echo "media backup completed: $FINAL_DIR"
