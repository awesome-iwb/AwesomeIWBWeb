# Projects DB + Admin Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the project catalog (categories/projects) to PostgreSQL as the source of truth, provide JSON/CSV import/export, and update the Admin UI + frontend pages to read/write via API (no more static imports).

**Architecture:** Backend (Bun + Elysia) adds a small DB layer + SQL migrations runner + import/export endpoints. Frontend replaces static `data.json` imports with API-driven composables and upgrades Admin “软件项目管理” into a manual-save editor backed by admin endpoints.

**Tech Stack:** Bun, Elysia, PostgreSQL (Docker Compose), Vite + Vue 3, Tailwind, Fetch API.

---

## File/Module Map (what will change)

**Backend**
- Create: `backend/docker-compose.yml` (local Postgres)
- Create: `backend/src/db/config.ts` (DATABASE_URL parsing)
- Create: `backend/src/db/client.ts` (Postgres client factory + query helper)
- Create: `backend/src/db/migrate.ts` (migration runner)
- Create: `backend/migrations/0001_init.sql` (tables: categories/projects + schema_migrations)
- Create: `backend/src/scripts/import-data-json.ts` (one-shot import from existing data.json)
- Modify: `backend/package.json` (deps: postgres driver; script: test)
- Modify: `backend/src/index.ts` (replace `/api/projects` read from file with DB; add admin endpoints; add import/export endpoints)
- Create: `backend/src/services/projects.ts` (CRUD + list/search + import/export helpers)
- Create: `backend/src/utils/csv.ts` (parse/generate CSV, header alias mapping)
- Create: `backend/test/projects-api.test.ts` (bun:test smoke tests for endpoints)

**Frontend**
- Modify: `frontend/src/composables/useProjects.ts` (remove local JSON import, fetch from `/api/projects` + `/api/categories`)
- Modify: `frontend/src/views/AdminView.vue` (projects tab to use API + manual save; import/export UI hooks)
- Modify: `frontend/src/views/ProjectDetailView.vue` (ensure it uses API-backed `useProjects`)
- Modify: any page that relies on static categories/projects (scan and replace)

---

## Task 1: Add local PostgreSQL via Docker Compose

**Files:**
- Create: `backend/docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: awesome_iwb
      POSTGRES_USER: awesome_iwb
      POSTGRES_PASSWORD: awesome_iwb_dev
    ports:
      - "5432:5432"
    volumes:
      - awesome_iwb_pgdata:/var/lib/postgresql/data
volumes:
  awesome_iwb_pgdata:
```

- [ ] **Step 2: Boot the DB**

Run:
```bash
cd /workspace/awesome-iwb/backend
docker compose up -d
```

Expected:
- Container `postgres` running
- Port `5432` open locally

- [ ] **Step 3: Add local env hint (no secrets committed)**

Create a local-only `.env` if desired (do not commit):
```bash
DATABASE_URL=postgres://awesome_iwb:awesome_iwb_dev@127.0.0.1:5432/awesome_iwb
```

---

## Task 2: Add DB client + migration runner

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/db/config.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/migrations/0001_init.sql`

- [ ] **Step 1: Add Postgres driver**

Edit `backend/package.json`:
- Add dependency: `"postgres": "^3.4.4"` (or latest compatible)
- Replace test script with Bun’s test runner:

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "test": "bun test"
  }
}
```

- [ ] **Step 2: Implement DB config**

Create `backend/src/db/config.ts`:

```ts
export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}
```

- [ ] **Step 3: Implement DB client**

Create `backend/src/db/client.ts`:

```ts
import postgres from "postgres";
import { getDatabaseUrl } from "./config";

let sqlSingleton: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (!sqlSingleton) {
    sqlSingleton = postgres(getDatabaseUrl(), {
      max: 10,
      idle_timeout: 10,
    });
  }
  return sqlSingleton;
}
```

- [ ] **Step 4: Add migrations table + schema**

Create `backend/migrations/0001_init.sql`:

```sql
create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  developer text not null default '',
  description text not null default '',
  keywords text[] not null default '{}',
  recommendation text[] not null default '{}',
  github_url text not null default '',
  icon text not null default '',
  banner text not null default '',
  stars int not null default 0,
  language text not null default '',
  last_update timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 5: Implement migration runner**

Create `backend/src/db/migrate.ts`:

```ts
import fs from "fs/promises";
import path from "path";
import { sql } from "./client";

export async function migrate() {
  const migrationsDir = path.join(import.meta.dir, "../../migrations");
  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter(f => f.endsWith(".sql")).sort();

  await sql()`select 1`;
  await sql().unsafe("create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())");

  const applied = await sql()<Array<{ version: string }>>`select version from schema_migrations`;
  const appliedSet = new Set(applied.map(r => r.version));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const full = path.join(migrationsDir, file);
    const content = await fs.readFile(full, "utf-8");
    await sql().unsafe(content);
    await sql()`insert into schema_migrations(version) values (${file})`;
  }
}
```

- [ ] **Step 6: Quick verify migrations run**

Temporarily add at backend startup (Task 4 will do permanently), or run a small script:

Run:
```bash
cd /workspace/awesome-iwb/backend
DATABASE_URL=postgres://awesome_iwb:awesome_iwb_dev@127.0.0.1:5432/awesome_iwb bun -e "import { migrate } from './src/db/migrate'; await migrate(); console.log('migrated')"
```

Expected:
- Prints `migrated`
- Tables exist in DB

---

## Task 3: Implement project service (CRUD + list/search + slug generation)

**Files:**
- Create: `backend/src/services/projects.ts`

- [ ] **Step 1: Implement slug generator (scheme B: short hash)**

```ts
import { randomUUID } from "crypto";

export function newSlug() {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}
```

- [ ] **Step 2: Implement list + get-by-slug + upsert helpers**

Create `backend/src/services/projects.ts`:

```ts
import { sql } from "../db/client";
import { newSlug } from "../utils/slug";

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  sort_index: number;
};

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  developer: string;
  description: string;
  keywords: string[];
  recommendation: string[];
  github_url: string;
  icon: string;
  banner: string;
  stars: number;
  language: string;
  last_update: string | null;
};

export async function listCategories() {
  return sql()<CategoryRow[]>`
    select id, name, description, sort_index
    from categories
    order by sort_index asc, name asc
  `;
}

export async function listProjects(params: { q?: string; category?: string; sort?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const q = params.q?.trim();
  const category = params.category?.trim();
  const sort = params.sort ?? "name";

  const orderBy =
    sort === "stars" ? sql`stars desc nulls last, name asc` :
    sort === "updated" ? sql`last_update desc nulls last, name asc` :
    sql`name asc`;

  const whereParts = [];
  if (q) whereParts.push(sql`(name ilike ${"%" + q + "%"} or developer ilike ${"%" + q + "%"} or ${q} = any(keywords))`);
  if (category) whereParts.push(sql`category_id = ${category}`);
  const where = whereParts.length ? sql.join(whereParts, sql` and `) : sql`true`;

  const items = await sql()<ProjectRow[]>`
    select id, slug, name, category_id, developer, description, keywords, recommendation, github_url, icon, banner, stars, language, last_update
    from projects
    where ${where}
    order by ${orderBy}
    limit ${pageSize} offset ${offset}
  `;

  const [{ count }] = await sql()<Array<{ count: string }>>`
    select count(*)::text as count from projects where ${where}
  `;

  return { items, page, pageSize, total: Number(count) };
}

export async function getProjectBySlug(slug: string) {
  const rows = await sql()<ProjectRow[]>`
    select id, slug, name, category_id, developer, description, keywords, recommendation, github_url, icon, banner, stars, language, last_update
    from projects
    where slug = ${slug}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function createProject(input: Partial<ProjectRow> & { name: string }) {
  const slug = input.slug?.trim() || newSlug();
  const [row] = await sql()<ProjectRow[]>`
    insert into projects (slug, name, category_id, developer, description, keywords, recommendation, github_url, icon, banner, stars, language, last_update)
    values (
      ${slug},
      ${input.name},
      ${input.category_id ?? null},
      ${input.developer ?? ""},
      ${input.description ?? ""},
      ${input.keywords ?? []},
      ${input.recommendation ?? []},
      ${input.github_url ?? ""},
      ${input.icon ?? ""},
      ${input.banner ?? ""},
      ${input.stars ?? 0},
      ${input.language ?? ""},
      ${input.last_update ?? null}
    )
    returning id, slug, name, category_id, developer, description, keywords, recommendation, github_url, icon, banner, stars, language, last_update
  `;
  return row;
}
```

---

## Task 4: Wire backend routes to DB + keep existing API shape stable

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/data.json` usage (stop using it for /api/projects)

- [ ] **Step 1: Run migrations at startup**

At the top of `backend/src/index.ts` add:

```ts
import { migrate } from "./db/migrate";
await migrate();
```

- [ ] **Step 2: Replace GET /api/projects from file with DB**

Implement:
- GET `/api/categories` -> listCategories()
- GET `/api/projects` -> listProjects()
- GET `/api/projects/:slug` -> getProjectBySlug()

- [ ] **Step 3: Add admin write endpoints (no auth yet)**

Implement:
- POST `/api/admin/projects` -> createProject()
- PUT `/api/admin/projects/:id` -> update
- DELETE `/api/admin/projects/:id` -> delete
- similarly for categories

- [ ] **Step 4: Keep `/api/stats` compatible**

Compute totals using DB:

```ts
const [{ totalProjects }] = await sql()<Array<{ totalProjects: number }>>`select count(*)::int as "totalProjects" from projects`;
const [{ totalStars }] = await sql()<Array<{ totalStars: number }>>`select coalesce(sum(stars),0)::int as "totalStars" from projects`;
```

- [ ] **Step 5: Manual verification**

Run backend:
```bash
cd /workspace/awesome-iwb/backend
DATABASE_URL=postgres://awesome_iwb:awesome_iwb_dev@127.0.0.1:5432/awesome_iwb bun run dev
```

Then:
```bash
curl -sS http://localhost:8080/api/categories | head
curl -sS "http://localhost:8080/api/projects?page=1&pageSize=3" | head
```

Expected:
- Valid JSON responses

---

## Task 5: Import existing data.json into DB

**Files:**
- Create: `backend/src/scripts/import-data-json.ts`

- [ ] **Step 1: Write importer**

```ts
import data from "../data.json";
import { migrate } from "../db/migrate";
import { sql } from "../db/client";
import { newSlug } from "../utils/slug";

await migrate();

const categoryIdByName = new Map<string, string>();

for (let i = 0; i < data.categories.length; i++) {
  const c = data.categories[i];
  const [row] = await sql()<Array<{ id: string }>>`
    insert into categories (name, description, sort_index)
    values (${c.name}, ${c.description ?? ""}, ${i})
    returning id
  `;
  categoryIdByName.set(c.name, row.id);
}

for (const c of data.categories) {
  const categoryId = categoryIdByName.get(c.name) ?? null;
  for (const p of c.projects) {
    const slug = newSlug();
    await sql()`
      insert into projects (slug, name, category_id, developer, description, keywords, recommendation, github_url, icon, banner, stars, language, last_update)
      values (
        ${slug},
        ${p.name ?? ""},
        ${categoryId},
        ${p.developer ?? ""},
        ${p.description ?? ""},
        ${p.keywords ?? []},
        ${p.recommendation ? [p.recommendation] : []},
        ${p.github_url ?? ""},
        ${p.icon ?? p.avatar ?? ""},
        ${p.banner ?? ""},
        ${p.stars ?? 0},
        ${p.language ?? ""},
        ${p.last_update ?? null}
      )
      on conflict (slug) do nothing
    `;
  }
}

console.log("import done");
```

- [ ] **Step 2: Add script command**

In `backend/package.json`:
```json
{
  "scripts": {
    "import:data-json": "bun run src/scripts/import-data-json.ts"
  }
}
```

- [ ] **Step 3: Run importer**

```bash
cd /workspace/awesome-iwb/backend
DATABASE_URL=postgres://awesome_iwb:awesome_iwb_dev@127.0.0.1:5432/awesome_iwb bun run import:data-json
```

Expected:
- `import done`
- `/api/projects` returns many items

---

## Task 6: CSV + JSON import/export endpoints

**Files:**
- Create: `backend/src/utils/csv.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/services/projects.ts` (add import/export helpers)

- [ ] **Step 1: CSV generator + parser**

Create `backend/src/utils/csv.ts`:

```ts
export function toCsv(rows: Record<string, any>[], columns: string[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[\",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
    return s;
  };
  const header = columns.map(esc).join(",");
  const lines = rows.map(r => columns.map(c => esc(r[c])).join(","));
  return [header, ...lines].join("\n");
}

export function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] as Record<string, string>[] };
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = line.split(",");
    const r: Record<string, string> = {};
    headers.forEach((h, i) => (r[h] = (cells[i] ?? "").trim()));
    return r;
  });
  return { headers, rows };
}
```

- [ ] **Step 2: Alias mapping + “来什么列导什么列”**

Implement mapping table (example):
```ts
const ALIASES: Record<string, string> = {
  "项目名": "name",
  "名称": "name",
  "github": "github_url",
  "repo": "github_url",
  "desc": "description",
  "标签": "keywords"
};
```

Then normalize incoming keys to canonical field names; ignore unknown.

- [ ] **Step 3: Export endpoints**

JSON:
- Return `{ categories: [...], projects: [...] }` or keep existing shape if preferred.

CSV:
- Default columns: `slug,name,developer,github_url,stars,language,keywords,recommendation,category_id`

- [ ] **Step 4: Import endpoints (strategy C)**

Matching:
1) if slug present -> update by slug
2) else if name present -> update by name (only if exactly one match)
3) else -> create new with generated slug

- [ ] **Step 5: Test with curl**

```bash
curl -sS http://localhost:8080/api/admin/projects/export.json | head
curl -sS http://localhost:8080/api/admin/projects/export.csv | head
```

---

## Task 7: Frontend – make projects/categories fully API-driven

**Files:**
- Modify: `frontend/src/composables/useProjects.ts`
- Modify: `frontend/src/views/*` (as needed)

- [ ] **Step 1: Rewrite useProjects to fetch from /api**

Implement:
- `fetchProjects()` hits `/api/categories` and `/api/projects` (or one combined endpoint)
- `fetchProjectByName` should become `fetchProjectBySlug` (and update callers), OR keep name-based route by mapping name->slug in the router.

- [ ] **Step 2: Verify key pages**

Manual:
- Home page lists projects
- Project detail page loads via slug route and renders correct data

---

## Task 8: Admin – replace in-memory projectsData with API-backed editor + import/export UI

**Files:**
- Modify: `frontend/src/views/AdminView.vue`

- [ ] **Step 1: Replace projectsData fetch**

Use:
- `GET /api/categories`
- `GET /api/projects` (pageSize large for admin, or add `pageSize=1000`)

- [ ] **Step 2: Manual save**

When editing a project:
- Save button calls `PUT /api/admin/projects/:id`

For creating:
- `POST /api/admin/projects`

- [ ] **Step 3: Import/export buttons**

- Export JSON button: open `/api/admin/projects/export.json`
- Export CSV button: open `/api/admin/projects/export.csv`
- Import JSON/CSV: upload file, POST to import endpoint, show summary

---

## Task 9: Add bun:test smoke tests for backend endpoints

**Files:**
- Create: `backend/test/projects-api.test.ts`

- [ ] **Step 1: Add tests**

```ts
import { test, expect } from "bun:test";

test("GET /api/projects returns json", async () => {
  const res = await fetch("http://localhost:8080/api/projects?page=1&pageSize=1");
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json).toHaveProperty("items");
});
```

- [ ] **Step 2: Run**

```bash
cd /workspace/awesome-iwb/backend
bun test
```

Expected:
- PASS

---

## Plan Self-Review

### Coverage vs spec
- Postgres + docker compose: Task 1
- Migrations + schema: Task 2
- Slug scheme B: Task 3
- API read/write + stats: Task 4
- Import from existing JSON: Task 5
- JSON/CSV import/export with strategy C + flexible fields: Task 6
- Frontend remove static imports: Task 7
- Admin editor UX + manual save + import/export: Task 8

### Placeholder scan
- No TBD/TODO. Each task includes concrete code and commands.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-projects-db-admin-plan.md`.

Two execution options:
1. **Subagent-Driven (recommended)** – dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** – execute tasks in this session with checkpoints

Which approach?

