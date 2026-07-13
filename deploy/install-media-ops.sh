#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/awesomeiwb}"
OPS_ROOT="/usr/local/lib/awesomeiwb-media"

install -d -m 0755 "$OPS_ROOT"
install -m 0755 "$APP_ROOT/deploy/backup-media.sh" "$OPS_ROOT/backup-media.sh"
install -m 0755 "$APP_ROOT/deploy/verify-media-backup.sh" "$OPS_ROOT/verify-media-backup.sh"
install -m 0755 "$APP_ROOT/deploy/prepare-media-storage.sh" "$OPS_ROOT/prepare-media-storage.sh"

if [[ "${PREPARE_MEDIA_STORAGE:-true}" == "true" ]]; then
  bash "$OPS_ROOT/prepare-media-storage.sh"
fi
install -d -m 0750 /var/log/awesomeiwb
install -m 0644 "$APP_ROOT/deploy/systemd/awesomeiwb-media-backup.service" /etc/systemd/system/awesomeiwb-media-backup.service
install -m 0644 "$APP_ROOT/deploy/systemd/awesomeiwb-media-backup.timer" /etc/systemd/system/awesomeiwb-media-backup.timer
# Overwrite the historical media cron entry with its comment-only retired
# version so the systemd timer and cron cannot run the same backup together.
install -m 0644 "$APP_ROOT/deploy/cron.d/awesomeiwb-backup-uploads" /etc/cron.d/awesomeiwb-backup-uploads
install -m 0644 "$APP_ROOT/deploy/cron.d/awesomeiwb-purge-media" /etc/cron.d/awesomeiwb-purge-media
systemctl daemon-reload
systemctl enable --now awesomeiwb-media-backup.timer
systemctl list-timers awesomeiwb-media-backup.timer --no-pager
