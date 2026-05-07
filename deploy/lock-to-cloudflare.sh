#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "必须使用 root 执行"; exit 1; }
command -v ufw >/dev/null 2>&1 || { echo "缺少 ufw，请先安装"; exit 1; }

TMP4="$(mktemp)"
TMP6="$(mktemp)"
trap 'rm -f "$TMP4" "$TMP6"' EXIT

curl -fsSL https://www.cloudflare.com/ips-v4 > "$TMP4"
curl -fsSL https://www.cloudflare.com/ips-v6 > "$TMP6"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp

while read -r cidr; do
  [ -n "$cidr" ] && ufw allow from "$cidr" to any port 80 proto tcp
  [ -n "$cidr" ] && ufw allow from "$cidr" to any port 443 proto tcp
done < "$TMP4"

while read -r cidr; do
  [ -n "$cidr" ] && ufw allow from "$cidr" to any port 80 proto tcp
  [ -n "$cidr" ] && ufw allow from "$cidr" to any port 443 proto tcp
done < "$TMP6"

ufw --force enable
ufw status verbose
