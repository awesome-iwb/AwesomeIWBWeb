import { Elysia, t } from "elysia";
import { cors } from '@elysiajs/cors'
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import seedData from "./data.json";
import { migrate } from "./db/migrate";
import {
  createCategory,
  createProject,
  deleteCategory,
  deleteProject,
  findCategoryIdByName,
  getCatalog,
  getProjectById,
  getProjectByKey,
  getStats,
  listCategories,
  listProjects,
  upsertCategoryByName,
  updateCategory,
  updateProject,
  upsertProjectBySlugOrName
} from "./services/projects";
import { parseCsv, toCsv } from "./utils/csv";
import { logAudit, listAuditLogs } from "./services/audit";
import { createProjectRevision, listProjectRevisions, rollbackProject } from "./services/revisions";
import { createSubmission, getSubmission, listSubmissions, updateSubmissionStatus } from "./services/submissions";
import { normalizeAiUsageState, readAiUsageStateField } from "./domain/aiUsage";

/**
 * Awesome-IWB backend API.
 *
 * Runtime modes:
 * - DB mode: enabled when `DATABASE_URL` is set; uses PostgreSQL and migrations.
 * - JSON mode: default; persists data to `backend/runtime/*.json` and seeds from `backend/src/data.json`.
 *
 * The public website uses `/api/projects` (catalog payload). The admin UI uses `/api/admin/*`.
 */
const STORIES_DIR = path.join(__dirname, "../stories");
await fs.mkdir(STORIES_DIR, { recursive: true });

const RUNTIME_DIR = path.join(__dirname, "../runtime");
await fs.mkdir(RUNTIME_DIR, { recursive: true });

const DATA_PATH = path.join(RUNTIME_DIR, "data.json");
const SUBMISSIONS_PATH = path.join(RUNTIME_DIR, "submissions.json");
const AUDIT_PATH = path.join(RUNTIME_DIR, "audit.json");
const REVISIONS_PATH = path.join(RUNTIME_DIR, "revisions.json");

/**
 * Toggle DB mode via environment.
 *
 * When enabled, the service uses `backend/src/db/*` and schema migrations.
 * When disabled, the service reads/writes JSON files under `backend/runtime/`.
 */
const dbEnabled = Boolean(process.env.DATABASE_URL);
if (dbEnabled) await migrate();

/**
 * Load JSON from disk with a fallback.
 *
 * Used by JSON mode to keep the server usable even when runtime files are missing
 * or partially corrupted (fallback to seed data).
 */
async function loadJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

/**
 * Persist JSON to disk (pretty-printed).
 *
 * JSON mode treats disk as the source of truth; do not call this in DB mode.
 */
async function saveJsonFile(filePath: string, value: any) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

const data = await loadJsonFile<any>(DATA_PATH, structuredClone(seedData as any));
const submissionsFile = await loadJsonFile<any[]>(SUBMISSIONS_PATH, []);
const auditFile = await loadJsonFile<any[]>(AUDIT_PATH, []);
const revisionsFile = await loadJsonFile<Record<string, any[]>>(REVISIONS_PATH, {});

/**
 * Ensure every project payload returned by JSON mode has a stable `ai_usage_state`.
 *
 * This keeps the frontend uniform while remaining compatible with legacy fields
 * (`ai_generated`, `human_verified`).
 */
function withAiUsageState(p: any) {
  return { ...p, ai_usage_state: normalizeAiUsageState(p) };
}

/**
 * Audit logger wrapper for both DB and JSON mode.
 *
 * In DB mode, persists to the audit table. In JSON mode, appends to runtime `audit.json`.
 */
async function logAuditCompat(input: { actor?: string; action: string; entity_type: string; entity_id?: string; diff?: any }) {
  try {
    if (dbEnabled) {
      await logAudit(input);
      return;
    }
    auditFile.unshift({
      id: randomUUID(),
      actor: input.actor ?? "system",
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? "",
      diff: input.diff ?? {},
      created_at: new Date().toISOString()
    });
    if (auditFile.length > 2000) auditFile.length = 2000;
    await saveJsonFile(AUDIT_PATH, auditFile);
  } catch {}
}

const app = new Elysia()
  .use(cors())
  .onError(({ error, set }) => {
    console.error(error);
    set.status = 500;
    return { error: error.message };
  })
  .get("/", () => "Welcome to Awesome-IWB API")
  .get("/api/categories", async () => {
    if (!dbEnabled) {
      return data.categories.map((c: any) => ({ id: c.id ?? c.name, name: c.name, description: c.description ?? "" }));
    }
    const catalog = await getCatalog();
    return catalog.categories.map((c: any) => ({ id: c.id, name: c.name, description: c.description }));
  })
  .get("/api/projects", async () => {
    if (!dbEnabled) {
      return {
        ...data,
        categories: (data.categories ?? []).map((c: any) => ({
          ...c,
          projects: (c.projects ?? []).map(withAiUsageState)
        }))
      };
    }
    return await getCatalog();
  })
  .post("/api/projects", async ({ body, set }) => {
    if (dbEnabled) {
      set.status = 400;
      return { error: "Use /api/admin/projects" };
    }
    const newData = body as any;
    await saveJsonFile(DATA_PATH, newData);
    Object.assign(data, newData);
    return { success: true };
  })
  .get("/api/projects/:name", async ({ params: { name }, set }) => {
    const key = decodeURIComponent(name);
    if (!dbEnabled) {
      let project = null;
      for (const cat of data.categories) {
        project = cat.projects.find((p: any) => p.name.toLowerCase() === key.toLowerCase());
        if (project) break;
      }
      if (!project) {
        set.status = 404;
        return { error: "Project not found" };
      }
      return withAiUsageState(project);
    }
    const project = await getProjectByKey(key);
    if (!project) {
      set.status = 404;
      return { error: "Project not found" };
    }
    return project;
  })
  .get("/api/stats", async () => {
    if (!dbEnabled) {
      const totalProjects = data.categories.reduce((acc: number, cat: any) => acc + cat.projects.length, 0);
      const totalStars = data.categories.reduce((acc: number, cat: any) => {
        return acc + cat.projects.reduce((sum: number, p: any) => sum + (p.stars || 0), 0);
      }, 0);
      return { totalProjects, totalStars };
    }
    return await getStats();
  })
  .post("/api/admin/categories", async ({ body, set }) => {
    const input = body as any;
    if (!input?.name) {
      set.status = 400;
      return { error: "name is required" };
    }
    if (!dbEnabled) {
      const id = randomUUID().replaceAll("-", "").slice(0, 8);
      (data as any).categories.push({ id, name: input.name, description: input.description ?? "", projects: [] });
      await saveJsonFile(DATA_PATH, data);
      await logAuditCompat({ action: "create", entity_type: "category", entity_id: id });
      return { id, name: input.name, description: input.description ?? "", sort_index: 0 };
    }
    const created = await createCategory({ name: input.name, description: input.description, sort_index: input.sort_index });
    await logAuditCompat({ action: "create", entity_type: "category", entity_id: created.id });
    return created;
  })
  .put("/api/admin/categories/:id", async ({ params: { id }, body, set }) => {
    if (!dbEnabled) {
      const cat = (data as any).categories.find((c: any) => String(c.id) === String(id));
      if (!cat) {
        set.status = 404;
        return { error: "Category not found" };
      }
      const before = { ...cat };
      Object.assign(cat, {
        name: (body as any)?.name ?? cat.name,
        description: (body as any)?.description ?? cat.description
      });
      await saveJsonFile(DATA_PATH, data);
      await logAuditCompat({ action: "update", entity_type: "category", entity_id: id, diff: { before, after: cat } });
      return { id: cat.id, name: cat.name, description: cat.description, sort_index: 0 };
    }
    const before = await listCategories().then((cs) => cs.find((c) => c.id === id) ?? null);
    const updated = await updateCategory(id, body as any);
    if (!updated) {
      set.status = 404;
      return { error: "Category not found" };
    }
    await logAuditCompat({ action: "update", entity_type: "category", entity_id: id, diff: { before, after: updated } });
    return updated;
  })
  .delete("/api/admin/categories/:id", async ({ params: { id }, set }) => {
    if (!dbEnabled) {
      const idx = (data as any).categories.findIndex((c: any) => String(c.id) === String(id));
      if (idx === -1) {
        set.status = 404;
        return { error: "Category not found" };
      }
      const removed = (data as any).categories.splice(idx, 1)[0];
      let uncat = (data as any).categories.find((c: any) => String(c.id) === "uncat");
      if (!uncat) {
        uncat = { id: "uncat", name: "📦 未分类", description: "", projects: [] };
        (data as any).categories.unshift(uncat);
      }
      if (Array.isArray(removed?.projects) && removed.projects.length) {
        uncat.projects.push(...removed.projects);
      }
      await saveJsonFile(DATA_PATH, data);
      await logAuditCompat({ action: "delete", entity_type: "category", entity_id: id, diff: { before: removed } });
      return { success: true };
    }
    const res = await deleteCategory(id);
    await logAuditCompat({ action: "delete", entity_type: "category", entity_id: id });
    return res;
  })
  .post("/api/admin/projects", async ({ body, set }) => {
    const input = body as any;
    if (!input?.name) {
      set.status = 400;
      return { error: "name is required" };
    }
    if (!dbEnabled) {
      const normalized: any = normalizeProjectInput(input);
      const categoryId = typeof normalized.category_id === "string" ? normalized.category_id : (data as any).categories[0]?.id;
      let cat = (data as any).categories.find((c: any) => String(c.id) === String(categoryId));
      if (!cat) cat = (data as any).categories[0];
      const project = {
        name: normalized.name,
        developer: normalized.developer,
        status: normalized.status,
        recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation.join(", ") : "",
        ai_usage_state: normalized.ai_usage_state ?? "unknown",
        github_url: normalized.github_url,
        avatar: normalized.avatar,
        icon: normalized.icon,
        banner: normalized.banner,
        description: normalized.description,
        keywords: normalized.keywords,
        stars: normalized.stars,
        language: normalized.language,
        last_update: normalized.last_update,
        version: normalized.version,
        github_is_fork: normalized.github_is_fork,
        github_parent_url: normalized.github_parent_url,
        github_source_url: normalized.github_source_url,
        releases: (normalized.extra as any)?.releases,
        relations: (normalized.extra as any)?.relations,
        reviews: (normalized.extra as any)?.reviews
      };
      cat.projects.unshift(project);
      await saveJsonFile(DATA_PATH, data);
      const id = encodeURIComponent(project.name);
      await logAuditCompat({ action: "create", entity_type: "project", entity_id: id });
      return { ...project, id, category_id: cat.id };
    }
    const created = await createProject(normalizeProjectInput(input));
    await logAuditCompat({ action: "create", entity_type: "project", entity_id: created.id });
    return created;
  })
  .put("/api/admin/projects/:id", async ({ params: { id }, body, set }) => {
    if (!dbEnabled) {
      const key = decodeURIComponent(id);
      let foundCat: any = null;
      let foundIdx = -1;
      for (const c of (data as any).categories) {
        const idx = (c.projects ?? []).findIndex((p: any) => String(p.name).toLowerCase() === String(key).toLowerCase());
        if (idx !== -1) {
          foundCat = c;
          foundIdx = idx;
          break;
        }
      }
      if (!foundCat || foundIdx === -1) {
        set.status = 404;
        return { error: "Project not found" };
      }
      const before = structuredClone(foundCat.projects[foundIdx]);
      const normalized: any = normalizeProjectInput(body as any);
      const next = {
        ...before,
        name: normalized.name || before.name,
        developer: normalized.developer,
        status: normalized.status,
        recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation.join(", ") : before.recommendation,
        ai_usage_state: normalized.ai_usage_state ?? before.ai_usage_state ?? normalizeAiUsageState(before),
        github_url: normalized.github_url,
        avatar: normalized.avatar,
        icon: normalized.icon,
        banner: normalized.banner,
        description: normalized.description,
        keywords: normalized.keywords,
        stars: normalized.stars,
        language: normalized.language,
        last_update: normalized.last_update,
        version: normalized.version,
        github_is_fork: normalized.github_is_fork,
        github_parent_url: normalized.github_parent_url,
        github_source_url: normalized.github_source_url
      };

      const revisionsKey = encodeURIComponent(before.name);
      const list = revisionsFile[revisionsKey] ?? [];
      list.unshift({ id: randomUUID(), created_at: new Date().toISOString(), snapshot: before });
      revisionsFile[revisionsKey] = list.slice(0, 20);
      await saveJsonFile(REVISIONS_PATH, revisionsFile);

      const targetCategoryId = typeof normalized.category_id === "string" ? normalized.category_id : foundCat.id;
      if (String(targetCategoryId) !== String(foundCat.id)) {
        const targetCat = (data as any).categories.find((c: any) => String(c.id) === String(targetCategoryId));
        if (targetCat) {
          foundCat.projects.splice(foundIdx, 1);
          targetCat.projects.unshift(next);
          foundCat = targetCat;
        } else {
          foundCat.projects[foundIdx] = next;
        }
      } else {
        foundCat.projects[foundIdx] = next;
      }

      await saveJsonFile(DATA_PATH, data);
      const newId = encodeURIComponent(next.name);
      await logAuditCompat({ action: "update", entity_type: "project", entity_id: newId, diff: { before, after: next } });
      return { ...next, id: newId, category_id: foundCat.id };
    }
    const before = await getProjectById(id);
    if (before) await createProjectRevision(id);
    const updated = await updateProject(id, normalizeProjectInput(body as any));
    if (!updated) {
      set.status = 404;
      return { error: "Project not found" };
    }
    await logAuditCompat({ action: "update", entity_type: "project", entity_id: id, diff: { before, after: updated } });
    return updated;
  })
  .delete("/api/admin/projects/:id", async ({ params: { id }, set }) => {
    if (!dbEnabled) {
      const key = decodeURIComponent(id);
      for (const c of (data as any).categories) {
        const idx = (c.projects ?? []).findIndex((p: any) => String(p.name).toLowerCase() === String(key).toLowerCase());
        if (idx !== -1) {
          const before = c.projects.splice(idx, 1)[0];
          await saveJsonFile(DATA_PATH, data);
          await logAuditCompat({ action: "delete", entity_type: "project", entity_id: id, diff: { before } });
          return { success: true };
        }
      }
      set.status = 404;
      return { error: "Project not found" };
    }
    const before = await getProjectById(id);
    const res = await deleteProject(id);
    await logAuditCompat({ action: "delete", entity_type: "project", entity_id: id, diff: { before } });
    return res;
  })
  .get("/api/admin/categories", async ({ set }) => {
    if (!dbEnabled) {
      return (data as any).categories.map((c: any) => ({ id: c.id ?? c.name, name: c.name, description: c.description ?? "", sort_index: 0 }));
    }
    return await listCategories();
  })
  .get("/api/admin/projects", async ({ query, set }) => {
    const q = typeof query.q === "string" ? query.q : undefined;
    const category = typeof query.category === "string" ? query.category : undefined;
    const sort =
      query.sort === "stars" || query.sort === "updated" || query.sort === "name"
        ? (query.sort as any)
        : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    if (!dbEnabled) {
      const flat: any[] = [];
      for (const c of (data as any).categories) {
        for (const p of c.projects ?? []) flat.push({ ...withAiUsageState(p), id: encodeURIComponent(p.name), category_id: c.id });
      }
      const ql = (q ?? "").trim().toLowerCase();
      const filtered = flat.filter((p) => {
        if (category && String(p.category_id) !== String(category)) return false;
        if (!ql) return true;
        return String(p.name ?? "").toLowerCase().includes(ql) || String(p.developer ?? "").toLowerCase().includes(ql);
      });
      const pPage = Math.max(1, page ?? 1);
      const pSize = Math.min(100, Math.max(1, pageSize ?? 20));
      const offset = (pPage - 1) * pSize;
      const items = filtered.slice(offset, offset + pSize);
      return { items, page: pPage, pageSize: pSize, total: filtered.length };
    }
    return await listProjects({ q, category, sort, page, pageSize });
  })
  .get("/api/admin/projects/export.json", async ({ set }) => {
    if (!dbEnabled) {
      await logAuditCompat({ action: "export_json", entity_type: "project", entity_id: "" });
      return data;
    }
    await logAuditCompat({ action: "export_json", entity_type: "project", entity_id: "" });
    return await getCatalog();
  })
  .get("/api/admin/projects/export.csv", async ({ set }) => {
    if (!dbEnabled) {
      await logAuditCompat({ action: "export_csv", entity_type: "project", entity_id: "" });
      const rows: Record<string, any>[] = [];
      for (const c of (data as any).categories) {
        for (const p of c.projects ?? []) {
          rows.push({
            slug: "",
            name: p.name ?? "",
            category_id: c.id ?? "",
            category_name: c.name ?? "",
            developer: p.developer ?? "",
            github_url: p.github_url ?? "",
            stars: p.stars ?? 0,
            language: p.language ?? "",
            keywords: Array.isArray(p.keywords) ? p.keywords.join(";") : "",
            recommendation: typeof p.recommendation === "string" ? p.recommendation : "",
            icon: p.icon ?? "",
            banner: p.banner ?? "",
            description: p.description ?? ""
          });
        }
      }
      const columns = [
        "slug",
        "name",
        "category_id",
        "category_name",
        "developer",
        "github_url",
        "stars",
        "language",
        "keywords",
        "recommendation",
        "icon",
        "banner",
        "description"
      ];
      const csv = toCsv(rows, columns);
      return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8" } });
    }

    await logAuditCompat({ action: "export_csv", entity_type: "project", entity_id: "" });
    const catalog: any = await getCatalog();
    const categoryNameById = new Map<string, string>(catalog.categories.map((c: any) => [c.id, c.name]));
    const rows: Record<string, any>[] = [];
    for (const c of catalog.categories) {
      for (const p of c.projects) {
        rows.push({
          slug: p.slug,
          name: p.name,
          category_id: p.category_id ?? c.id,
          category_name: categoryNameById.get(p.category_id ?? c.id) ?? "",
          developer: p.developer ?? "",
          github_url: p.github_url ?? "",
          stars: p.stars ?? 0,
          language: p.language ?? "",
          keywords: Array.isArray(p.keywords) ? p.keywords.join(";") : "",
          recommendation: Array.isArray(p.recommendation) ? p.recommendation.join(";") : "",
          icon: p.icon ?? "",
          banner: p.banner ?? "",
          description: p.description ?? ""
        });
      }
    }

    const columns = [
      "slug",
      "name",
      "category_id",
      "category_name",
      "developer",
      "github_url",
      "stars",
      "language",
      "keywords",
      "recommendation",
      "icon",
      "banner",
      "description"
    ];
    const csv = toCsv(rows, columns);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8"
      }
    });
  })
  .post("/api/admin/projects/import.json", async ({ body, set }) => {
      const payload: any = body as any;
      const incomingProjects: any[] = [];
      const incomingCategories: any[] = Array.isArray(payload?.categories) ? payload.categories : [];

      for (const c of incomingCategories) {
        if (!c?.name) continue;
        if (dbEnabled) {
          const { id } = await upsertCategoryByName({ name: c.name, description: c.description });
          const projects = Array.isArray(c.projects) ? c.projects : [];
          for (const p of projects) incomingProjects.push({ ...p, category_id: p.category_id ?? id });
        } else {
          const cat = (data as any).categories.find((x: any) => String(x.name).toLowerCase() === String(c.name).toLowerCase());
          const categoryId = cat?.id ?? randomUUID().replaceAll("-", "").slice(0, 8);
          if (!cat) (data as any).categories.push({ id: categoryId, name: c.name, description: c.description ?? "", projects: [] });
          const projects = Array.isArray(c.projects) ? c.projects : [];
          for (const p of projects) incomingProjects.push({ ...p, category_id: categoryId });
        }
      }

      if (Array.isArray(payload?.projects)) {
        for (const p of payload.projects) incomingProjects.push(p);
      }

      if (!incomingProjects.length) {
        set.status = 400;
        return { error: "No projects found in payload" };
      }

      const results = { created: 0, updated: 0 };
      for (const p of incomingProjects) {
        if (!p?.name) continue;
        const normalized = normalizeProjectInput(p);
        if (!dbEnabled) {
          const key = String(normalized.name).trim();
          let foundCat: any = null;
          let foundIdx = -1;
          for (const c of (data as any).categories) {
            const idx = (c.projects ?? []).findIndex((pp: any) => String(pp.name).toLowerCase() === key.toLowerCase());
            if (idx !== -1) {
              foundCat = c;
              foundIdx = idx;
              break;
            }
          }
          const targetCat = (data as any).categories.find((c: any) => String(c.id) === String(normalized.category_id)) ?? foundCat ?? (data as any).categories[0];
          const next = {
            name: normalized.name,
            developer: normalized.developer,
            status: normalized.status,
            recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation.join(", ") : "",
            ai_usage_state: normalized.ai_usage_state ?? "unknown",
            github_url: normalized.github_url,
            avatar: normalized.avatar,
            icon: normalized.icon,
            banner: normalized.banner,
            description: normalized.description,
            keywords: normalized.keywords,
            stars: normalized.stars,
            language: normalized.language,
            last_update: normalized.last_update,
            version: normalized.version
          };
          if (foundCat && foundIdx !== -1) {
            foundCat.projects.splice(foundIdx, 1);
            targetCat.projects.unshift(next);
            results.updated++;
          } else {
            targetCat.projects.unshift(next);
            results.created++;
          }
        } else {
          const r = await upsertProjectBySlugOrName(normalized);
          if (r.action === "created") results.created++;
          if (r.action === "updated") results.updated++;
        }
      }
      if (!dbEnabled) await saveJsonFile(DATA_PATH, data);
      await logAuditCompat({ action: "import_json", entity_type: "project", entity_id: "", diff: results });
      return { success: true, ...results };
  })
  .post(
    "/api/admin/projects/import.csv",
    async ({ body, set }) => {
      const file = (body as any).file as File | undefined;
      if (!file) {
        set.status = 400;
        return { error: "file is required" };
      }
      const text = await file.text();
      const { rows } = parseCsv(text);
      const results = { created: 0, updated: 0, skipped: 0 };
      for (const rawRow of rows) {
        const normalizedRow = normalizeCsvRow(rawRow);
        if (!normalizedRow.name) {
          results.skipped++;
          continue;
        }

        if (normalizedRow.category_name && !normalizedRow.category_id) {
          if (dbEnabled) {
            const { id } = await upsertCategoryByName({ name: normalizedRow.category_name });
            normalizedRow.category_id = id;
          } else {
            const cat = (data as any).categories.find((c: any) => String(c.name).toLowerCase() === String(normalizedRow.category_name).toLowerCase());
            const categoryId = cat?.id ?? randomUUID().replaceAll("-", "").slice(0, 8);
            if (!cat) (data as any).categories.push({ id: categoryId, name: normalizedRow.category_name, description: "", projects: [] });
            normalizedRow.category_id = categoryId;
          }
        }

        if (!dbEnabled) {
          const normalized = normalizeProjectInput(normalizedRow);
          const key = String(normalized.name).trim();
          let foundCat: any = null;
          let foundIdx = -1;
          for (const c of (data as any).categories) {
            const idx = (c.projects ?? []).findIndex((pp: any) => String(pp.name).toLowerCase() === key.toLowerCase());
            if (idx !== -1) {
              foundCat = c;
              foundIdx = idx;
              break;
            }
          }
          const targetCat = (data as any).categories.find((c: any) => String(c.id) === String(normalized.category_id)) ?? foundCat ?? (data as any).categories[0];
          const next = {
            name: normalized.name,
            developer: normalized.developer,
            status: normalized.status,
            recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation.join(", ") : "",
            ai_usage_state: normalized.ai_usage_state ?? "unknown",
            github_url: normalized.github_url,
            avatar: normalized.avatar,
            icon: normalized.icon,
            banner: normalized.banner,
            description: normalized.description,
            keywords: normalized.keywords,
            stars: normalized.stars,
            language: normalized.language,
            last_update: normalized.last_update,
            version: normalized.version
          };
          if (foundCat && foundIdx !== -1) {
            foundCat.projects.splice(foundIdx, 1);
            targetCat.projects.unshift(next);
            results.updated++;
          } else {
            targetCat.projects.unshift(next);
            results.created++;
          }
        } else {
          const r = await upsertProjectBySlugOrName(normalizeProjectInput(normalizedRow));
          if (r.action === "created") results.created++;
          if (r.action === "updated") results.updated++;
        }
      }
      if (!dbEnabled) await saveJsonFile(DATA_PATH, data);
      await logAuditCompat({ action: "import_csv", entity_type: "project", entity_id: "", diff: results });
      return { success: true, ...results };
    },
    {
      body: t.Object({
        file: t.File()
      })
    }
  )
  .get("/api/admin/audit-logs", async ({ query, set }) => {
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    if (!dbEnabled) {
      const pPage = Math.max(1, page ?? 1);
      const pSize = Math.min(100, Math.max(1, pageSize ?? 50));
      const offset = (pPage - 1) * pSize;
      return { items: auditFile.slice(offset, offset + pSize), page: pPage, pageSize: pSize, total: auditFile.length };
    }
    return await listAuditLogs({ page, pageSize });
  })
  .get("/api/admin/projects/:id/revisions", async ({ params: { id }, set }) => {
    if (!dbEnabled) return revisionsFile[id] ?? [];
    return await listProjectRevisions(id);
  })
  .post("/api/admin/projects/:id/rollback", async ({ params: { id }, body, set }) => {
    const revisionId = (body as any)?.revisionId;
    if (!revisionId) {
      set.status = 400;
      return { error: "revisionId is required" };
    }
    if (!dbEnabled) {
      const key = decodeURIComponent(id);
      const list = revisionsFile[id] ?? [];
      const entry = list.find((r: any) => r.id === revisionId);
      if (!entry) {
        set.status = 404;
        return { error: "Revision not found" };
      }
      for (const c of (data as any).categories) {
        const idx = (c.projects ?? []).findIndex((p: any) => String(p.name).toLowerCase() === String(key).toLowerCase());
        if (idx !== -1) {
          const before = structuredClone(c.projects[idx]);
          c.projects[idx] = entry.snapshot;
          await saveJsonFile(DATA_PATH, data);
          await logAuditCompat({ action: "rollback", entity_type: "project", entity_id: id, diff: { before, after: entry.snapshot, revisionId } });
          return { ...entry.snapshot, id: encodeURIComponent(entry.snapshot.name), category_id: c.id };
        }
      }
      set.status = 404;
      return { error: "Project not found" };
    }
    const before = await getProjectById(id);
    const updated = await rollbackProject(id, revisionId);
    if (!updated) {
      set.status = 404;
      return { error: "Revision not found" };
    }
    await logAuditCompat({ action: "rollback", entity_type: "project", entity_id: id, diff: { before, after: updated, revisionId } });
    return updated;
  })
  .post("/api/submissions", async ({ body, set }) => {
    const payload: any = body as any;
    if (!payload?.name || !payload?.developer || !payload?.github_url) {
      set.status = 400;
      return { error: "name, developer, github_url are required" };
    }
    if (!dbEnabled) {
      const created = { id: randomUUID(), status: "pending", payload, review_note: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      submissionsFile.unshift(created);
      await saveJsonFile(SUBMISSIONS_PATH, submissionsFile);
      await logAuditCompat({ action: "submit", entity_type: "submission", entity_id: created.id });
      return { success: true, submissionId: created.id };
    }
    const created = await createSubmission(payload);
    await logAuditCompat({ action: "submit", entity_type: "submission", entity_id: created.id });
    return { success: true, submissionId: created.id };
  })
  .post("/api/submit", async ({ body, set }) => {
    const payload: any = body as any;
    if (!payload?.name || !payload?.developer || !payload?.github_url) {
      set.status = 400;
      return { error: "name, developer, github_url are required" };
    }
    if (!dbEnabled) {
      const created = { id: randomUUID(), status: "pending", payload, review_note: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      submissionsFile.unshift(created);
      await saveJsonFile(SUBMISSIONS_PATH, submissionsFile);
      await logAuditCompat({ action: "submit", entity_type: "submission", entity_id: created.id });
      return { success: true, submissionId: created.id };
    }
    const created = await createSubmission(payload);
    await logAuditCompat({ action: "submit", entity_type: "submission", entity_id: created.id });
    return { success: true, submissionId: created.id };
  })
  .get("/api/admin/submissions", async ({ query, set }) => {
    const status = typeof query.status === "string" ? query.status : undefined;
    const q = typeof query.q === "string" ? query.q : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    if (!dbEnabled) {
      const pPage = Math.max(1, page ?? 1);
      const pSize = Math.min(100, Math.max(1, pageSize ?? 20));
      const offset = (pPage - 1) * pSize;
      const st = status ?? "pending";
      const ql = (q ?? "").trim().toLowerCase();
      const filtered = submissionsFile.filter((s: any) => {
        if (st && String(s.status) !== String(st)) return false;
        if (!ql) return true;
        return String(s.payload?.name ?? "").toLowerCase().includes(ql) || String(s.payload?.github_url ?? "").toLowerCase().includes(ql);
      });
      return { items: filtered.slice(offset, offset + pSize), page: pPage, pageSize: pSize, total: filtered.length };
    }
    return await listSubmissions({ status, q, page, pageSize });
  })
  .get("/api/admin/submissions/:id", async ({ params: { id }, set }) => {
    const item = !dbEnabled ? submissionsFile.find((s: any) => s.id === id) : await getSubmission(id);
    if (!item) {
      set.status = 404;
      return { error: "Submission not found" };
    }
    return item;
  })
  .post("/api/admin/submissions/:id/reject", async ({ params: { id }, body, set }) => {
    const note = String((body as any)?.review_note ?? "");
    if (!dbEnabled) {
      const s = submissionsFile.find((x: any) => x.id === id);
      if (!s) {
        set.status = 404;
        return { error: "Submission not found" };
      }
      s.status = "rejected";
      s.review_note = note;
      s.updated_at = new Date().toISOString();
      await saveJsonFile(SUBMISSIONS_PATH, submissionsFile);
      await logAuditCompat({ action: "reject", entity_type: "submission", entity_id: id, diff: { review_note: note } });
      return { success: true };
    }
    const updated = await updateSubmissionStatus(id, "rejected", note);
    if (!updated) {
      set.status = 404;
      return { error: "Submission not found" };
    }
    await logAuditCompat({ action: "reject", entity_type: "submission", entity_id: id, diff: { review_note: note } });
    return { success: true };
  })
  .post("/api/admin/submissions/:id/approve", async ({ params: { id }, body, set }) => {
    try {
      const submission = !dbEnabled ? submissionsFile.find((s: any) => s.id === id) : await getSubmission(id);
      if (!submission) {
        set.status = 404;
        return { error: "Submission not found" };
      }
      const input: any = body as any;
      const projectInput = normalizeProjectInput(input?.project ?? submission.payload ?? {});
      if (!projectInput.name) {
        set.status = 400;
        return { error: "project.name is required" };
      }

    let categoryId: string | null = null;
    if (typeof input?.category_id === "string" && input.category_id.trim()) {
      categoryId = input.category_id.trim();
    } else if (typeof input?.category_name === "string" && input.category_name.trim()) {
      const name = input.category_name.trim();
      if (!dbEnabled) {
        const cat = (data as any).categories.find((c: any) => String(c.name).toLowerCase() === name.toLowerCase());
        categoryId = cat?.id ?? null;
        if (!categoryId) {
          categoryId = randomUUID().replaceAll("-", "").slice(0, 8);
          (data as any).categories.push({ id: categoryId, name, description: "", projects: [] });
          setTimeout(() => {
            void saveJsonFile(DATA_PATH, data);
          }, 0);
          void logAuditCompat({ action: "create", entity_type: "category", entity_id: categoryId, diff: { name } });
        }
      } else {
        categoryId = (await findCategoryIdByName(name)) ?? null;
        if (!categoryId) {
          const created = await createCategory({ name });
          categoryId = created.id;
          await logAuditCompat({ action: "create", entity_type: "category", entity_id: categoryId, diff: { name } });
        }
      }
    } else if (typeof (submission.payload as any)?.category === "string") {
      const name = String((submission.payload as any).category).trim();
      if (name) {
        if (!dbEnabled) {
          const cat = (data as any).categories.find((c: any) => String(c.name).toLowerCase() === name.toLowerCase());
          categoryId = cat?.id ?? null;
          if (!categoryId) {
            categoryId = randomUUID().replaceAll("-", "").slice(0, 8);
            (data as any).categories.push({ id: categoryId, name, description: "", projects: [] });
            setTimeout(() => {
              void saveJsonFile(DATA_PATH, data);
            }, 0);
            void logAuditCompat({ action: "create", entity_type: "category", entity_id: categoryId, diff: { name } });
          }
        } else {
          categoryId = (await findCategoryIdByName(name)) ?? null;
          if (!categoryId) {
            const created = await createCategory({ name });
            categoryId = created.id;
            await logAuditCompat({ action: "create", entity_type: "category", entity_id: categoryId, diff: { name } });
          }
        }
      }
    }

      if (!dbEnabled) {
      const targetCat = (data as any).categories.find((c: any) => String(c.id) === String(categoryId)) ?? (data as any).categories[0];
      if (!targetCat || !Array.isArray(targetCat.projects)) {
        set.status = 500;
        return { error: "Target category invalid" };
      }
      const project = {
        name: projectInput.name,
        developer: projectInput.developer,
        status: projectInput.status,
        recommendation: Array.isArray(projectInput.recommendation) ? projectInput.recommendation.join(", ") : "",
        ai_usage_state: projectInput.ai_usage_state ?? "unknown",
        github_url: projectInput.github_url,
        avatar: projectInput.avatar,
        icon: projectInput.icon,
        banner: projectInput.banner,
        description: projectInput.description,
        keywords: projectInput.keywords,
        stars: projectInput.stars,
        language: projectInput.language,
        last_update: projectInput.last_update,
        version: projectInput.version
      };
      targetCat.projects.unshift(project);
      submission.status = "approved";
      submission.review_note = "";
      submission.updated_at = new Date().toISOString();
      setTimeout(() => {
        void saveJsonFile(DATA_PATH, data);
        void saveJsonFile(SUBMISSIONS_PATH, submissionsFile);
      }, 0);

      const projectId = encodeURIComponent(project.name);
      void logAuditCompat({ action: "approve", entity_type: "submission", entity_id: id, diff: { project_id: projectId } });
      void logAuditCompat({ action: "create", entity_type: "project", entity_id: projectId, diff: { from_submission: id } });
      set.headers["content-type"] = "application/json; charset=utf-8";
      return JSON.stringify({ success: true, project_id: projectId });
      }

      const createdProject = await createProject({ ...projectInput, category_id: categoryId });
      await updateSubmissionStatus(id, "approved", "");
      await logAuditCompat({ action: "approve", entity_type: "submission", entity_id: id, diff: { project_id: createdProject.id } });
      await logAuditCompat({ action: "create", entity_type: "project", entity_id: createdProject.id, diff: { from_submission: id } });
      set.headers["content-type"] = "application/json; charset=utf-8";
      return JSON.stringify({ success: true, project_id: createdProject.id });
    } catch (e: any) {
      set.status = 500;
      return { error: e?.message ?? String(e) };
    }
  })
  .get("/api/stories", async () => {
    try {
      const dirs = await fs.readdir(STORIES_DIR);
      const stories = [];
      for (const dir of dirs) {
        const stat = await fs.stat(path.join(STORIES_DIR, dir));
        if (stat.isDirectory()) {
          const metaPath = path.join(STORIES_DIR, dir, "meta.json");
          const mdPath = path.join(STORIES_DIR, dir, "content.md");
          try {
            const metaContent = await fs.readFile(metaPath, "utf-8");
            const meta = JSON.parse(metaContent);
            const content = await fs.readFile(mdPath, "utf-8");
            stories.push({ ...meta, content });
          } catch (err) {
            console.error(`Error reading story ${dir}:`, err);
          }
        }
      }
      return stories;
    } catch (err) {
      return [];
    }
  })
  .get("/api/stories/:id/:filename", ({ params: { id, filename } }) => {
    const filePath = path.join(STORIES_DIR, id, filename);
    return Bun.file(filePath);
  })
  .post("/api/stories", async ({ body }) => {
    // In a real app, we'd save this to the DB/JSON file. For now, we update in-memory and write to file.
    const newStories = body as any;
    
    for (const story of newStories) {
      const dirPath = path.join(STORIES_DIR, story.id);
      await fs.mkdir(dirPath, { recursive: true });
      
      const { content, ...meta } = story;
      
      await fs.writeFile(path.join(dirPath, "meta.json"), JSON.stringify(meta, null, 2));
      await fs.writeFile(path.join(dirPath, "content.md"), content || "");
    }

    return { success: true };
  })
  .post("/api/upload", async ({ body: { image } }) => {
    if (!image) throw new Error("No image provided");
    const ext = image.name.split('.').pop() || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const uploadPath = path.join(__dirname, '../../frontend/public/uploads', filename);
    await write(uploadPath, image);
    return { url: `/uploads/${filename}` };
  }, {
    body: t.Object({
      image: t.File()
    })
  })
  .listen(8080);

/**
 * Normalize a CSV row into the internal project payload shape.
 *
 * The CSV import supports bilingual / alias column headers and maps them into canonical keys.
 * The return value is a partial project input that is further sanitized by {@link normalizeProjectInput}.
 */
function normalizeCsvRow(row: Record<string, string>) {
  const aliases: Record<string, string> = {
    项目名: "name",
    名称: "name",
    github: "github_url",
    repo: "github_url",
    desc: "description",
    标签: "keywords",
    推荐: "recommendation",
    分类: "category_name",
    分类名: "category_name",
    分类ID: "category_id",
    slug: "slug",
    name: "name",
    developer: "developer",
    github_url: "github_url",
    stars: "stars",
    language: "language",
    keywords: "keywords",
    recommendation: "recommendation",
    icon: "icon",
    avatar: "avatar",
    banner: "banner",
    description: "description",
    category_id: "category_id",
    category_name: "category_name"
  };

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = aliases[k.trim()] ?? aliases[k.trim().toLowerCase()];
    if (!key) continue;
    out[key] = v;
  }

  if (typeof out.stars === "string" && out.stars.trim().length) out.stars = Number(out.stars);
  return out;
}

/**
 * Sanitize project input from API payloads and CSV import.
 *
 * Conventions:
 * - List-like fields accept arrays or delimiter-separated strings (`; , ，`).
 * - `ai_usage_state` is only accepted when explicitly present in the payload; otherwise it is left
 *   undefined so JSON-mode updates can preserve existing values and/or fall back to legacy flags.
 * - Unknown / missing fields are normalized to stable empty values for the frontend.
 */
function normalizeProjectInput(p: any) {
  const normalizeList = (v: any) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v !== "string") return [];
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
      } catch {}
    }
    return s.split(/[;,，]/).map((x) => x.trim()).filter(Boolean);
  };

  return {
    slug: typeof p.slug === "string" ? p.slug.trim() : undefined,
    name: String(p.name ?? "").trim(),
    category_id: typeof p.category_id === "string" ? p.category_id : null,
    developer: typeof p.developer === "string" ? p.developer : "",
    status: typeof p.status === "string" ? p.status : "",
    version: typeof p.version === "string" ? p.version : "",
    ai_usage_state: readAiUsageStateField(p),
    description: typeof p.description === "string" ? p.description : "",
    keywords: normalizeList(p.keywords),
    recommendation: normalizeList(p.recommendation),
    github_url: typeof p.github_url === "string" ? p.github_url : "",
    avatar: typeof p.avatar === "string" ? p.avatar : "",
    icon: typeof p.icon === "string" ? p.icon : "",
    banner: typeof p.banner === "string" ? p.banner : "",
    stars: typeof p.stars === "number" && !Number.isNaN(p.stars) ? p.stars : 0,
    language: typeof p.language === "string" ? p.language : "",
    last_update: typeof p.last_update === "string" ? p.last_update : null,
    github_is_fork: typeof p.github_is_fork === "boolean" ? p.github_is_fork : false,
    github_parent_url: typeof p.github_parent_url === "string" ? p.github_parent_url : "",
    github_source_url: typeof p.github_source_url === "string" ? p.github_source_url : "",
    extra: typeof p.extra === "object" && p.extra ? p.extra : {}
  };
}

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
