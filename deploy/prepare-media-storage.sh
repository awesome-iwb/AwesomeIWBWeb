#!/usr/bin/env bash
set -euo pipefail

RUNTIME_ROOT="${RUNTIME_ROOT:-/opt/awesomeiwb/backend/runtime}"
STORIES_ROOT="${STORIES_ROOT:-/opt/awesomeiwb/backend/stories}"
APP_UID="${APP_UID:-1000}"
APP_GID="${APP_GID:-1000}"

[[ "$RUNTIME_ROOT" = /* && "$RUNTIME_ROOT" != "/" ]] || { echo "unsafe RUNTIME_ROOT: $RUNTIME_ROOT" >&2; exit 1; }
[[ "$STORIES_ROOT" = /* && "$STORIES_ROOT" != "/" ]] || { echo "unsafe STORIES_ROOT: $STORIES_ROOT" >&2; exit 1; }
[[ "$APP_UID" =~ ^[0-9]+$ && "$APP_GID" =~ ^[0-9]+$ ]] || { echo "APP_UID and APP_GID must be numeric" >&2; exit 1; }

mkdir -p \
  "$RUNTIME_ROOT/uploads" \
  "$RUNTIME_ROOT/media/objects" \
  "$RUNTIME_ROOT/media/derivatives" \
  "$RUNTIME_ROOT/media/staging" \
  "$STORIES_ROOT"

chown -R "$APP_UID:$APP_GID" "$RUNTIME_ROOT"
chown -R "$APP_UID:$APP_GID" "$STORIES_ROOT"
chmod 0750 "$RUNTIME_ROOT"
find "$STORIES_ROOT" -type d -exec chmod 0750 {} +
find "$STORIES_ROOT" -type f -exec chmod 0640 {} +
find "$RUNTIME_ROOT/media" -type d -exec chmod 0750 {} +
find "$RUNTIME_ROOT/media" -type f -exec chmod 0640 {} +

# Legacy uploads remain available for reads and migration, but v2 code must
# never write, move, or delete them.
find "$RUNTIME_ROOT/uploads" -type d -exec chmod 0550 {} +
find "$RUNTIME_ROOT/uploads" -type f -exec chmod 0440 {} +

echo "media and stories permissions prepared for $APP_UID:$APP_GID"
