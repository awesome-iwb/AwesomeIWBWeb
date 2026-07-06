# Awesome-IWB Backend API

Backend service for Awesome-IWB. The public website keeps using the legacy catalog
routes such as `/api/projects`; external AI, Agent, program, and bot integrations
should use the stable read-only `/api/agent/*` routes.

## Development

```bash
bun install
bun run dev
```

The server listens on `PORT` or `8081` by default.

## Agent API

All `/api/agent/*` endpoints are public read-only JSON endpoints. They do not
require cookies or Bearer tokens, return only public fields, and support normal
HTTP caching with `ETag`.

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/agent/health` | Agent API health check |
| GET | `/api/agent/projects` | Paginated public project list |
| GET | `/api/agent/projects/:slug` | Public project detail by slug or unique name |
| GET | `/api/agent/search/projects?q=...` | Fuzzy project search |
| GET | `/api/agent/developers` | Paginated public developer list |
| GET | `/api/agent/developers/:id` | Public developer detail |
| GET | `/api/agent/search/developers?q=...` | Fuzzy developer search |
| GET | `/api/agent/categories` | Public category metadata |
| GET | `/api/agent/tags` | Public tag metadata |

List and search routes use:

- `page`: default `1`, minimum `1`
- `pageSize`: default `20`, maximum `100`
- `sort` for projects: `name`, `stars`, or `updated`
- `q` for fuzzy search over public project/developer fields

Project list responses use:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

### Examples

curl:

```bash
curl "http://localhost:8081/api/agent/projects?page=1&pageSize=20&sort=stars"
curl "http://localhost:8081/api/agent/search/projects?q=class"
curl "http://localhost:8081/api/agent/search/developers?q=alice"
```

JavaScript:

```js
const res = await fetch("http://localhost:8081/api/agent/search/projects?q=class");
if (!res.ok) throw new Error(`Agent API failed: ${res.status}`);
const data = await res.json();
console.log(data.items);
```

Python:

```python
import requests

response = requests.get(
    "http://localhost:8081/api/agent/projects",
    params={"page": 1, "pageSize": 20, "sort": "updated"},
    timeout=10,
)
response.raise_for_status()
print(response.json()["items"])
```

## Validation

```bash
bun test
```
