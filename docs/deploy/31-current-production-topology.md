# Current Production Topology

Date verified: 2026-07-07

This is the actual live topology for `https://aiwb.smart-teach.cn`.

## Request Path

- Public traffic enters through Cloudflare.
- The server listens on ports 80 and 443 through the Docker container
  `1Panel-openresty-zpMY`.
- Static website files are served by OpenResty from the container path
  `/www/sites/aiwb.smart-teach.cn/dist`.
- That container path is backed by this host path:
  `/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist`.
- API traffic is proxied by OpenResty to `http://127.0.0.1:8081`.
- The live API include is the host file
  `/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/api.conf`.
- In its `/api/uploads/` location, immutable caching must apply only to
  successful responses. Never add it with `always`, because media verification
  404 responses deliberately carry `Cache-Control: no-store`.
- Port `127.0.0.1:8081` is provided by Docker container `awesomeiwb-backend`.
- PostgreSQL is Docker container `awesomeiwb-pg`.

## What Is Not Live

- `nginx.service` on the host is inactive and is not the public entrypoint.
- `awesomeiwb-backend.service` on the host is inactive and should not be used
  for production because the host process cannot resolve Docker-only database
  hostnames such as `postgres`.
- `/var/www/awesomeiwb/dist` is not the active OpenResty static root.

## Update Flow

Use `deploy/update.sh`.

The script now:

- updates `/opt/awesomeiwb` from `origin/main`,
- rebuilds and restarts the Docker backend with
  `docker compose -f /opt/awesomeiwb/deploy/docker-compose.yml`,
- builds the frontend under `/opt/awesomeiwb/frontend`,
- syncs `frontend/dist/` to
  `/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/`,
- validates and reloads OpenResty inside `1Panel-openresty-zpMY`.

## Validation

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
ss -ltnp | grep -E ':(80|443|8081)\b'
curl -sS https://aiwb.smart-teach.cn/api/agent/health
curl -sS https://aiwb.smart-teach.cn/admin/notifications | head
```
