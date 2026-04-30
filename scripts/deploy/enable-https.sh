#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root (or via sudo)" >&2
  exit 1
fi

if [[ -z "$DOMAIN" ]]; then
  echo "DOMAIN is required" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y certbot python3-certbot-nginx

args=(--nginx -d "$DOMAIN" --redirect --agree-tos --non-interactive)
if [[ -n "$EMAIL" ]]; then
  args+=(--email "$EMAIL")
else
  args+=(--register-unsafely-without-email)
fi

certbot "${args[@]}"
nginx -t
systemctl reload nginx

echo "OK"
echo "url: https://${DOMAIN}/"

