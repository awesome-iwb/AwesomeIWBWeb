import { Elysia, t } from "elysia";
import { cors } from '@elysiajs/cors'
import { randomUUID } from "crypto";
import crypto from "crypto";
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
import { applyProjectPatch } from "./domain/projectUpdate";
import { normalizeProjectInput } from "./domain/normalizeProjectInput";
import { createFeedback, listFeedback, updateFeedback } from "./services/feedback";
import { sanitizeIssueLabels } from "./domain/feedbackLabels";
import { normalizeProjectTags } from "./domain/projectTags";
import { authPlugin, requireAuth, requireRole } from "./plugins/auth";
import { casdoorAuthPlugin } from "./plugins/casdoorAuth";
import { localAuthPlugin } from "./plugins/localAuth";
import { listUsers, setUserRole, setUserActive } from "./services/users";
import { ensureSuperadminInitialized } from "./services/localAccounts";
import { appConfig } from "./config";
import { checkRateLimit } from "./plugins/rateLimit";

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

const UPLOADS_DIR = path.join(RUNTIME_DIR, "uploads");
await fs.mkdir(UPLOADS_DIR, { recursive: true });

const DATA_PATH = path.join(RUNTIME_DIR, "data.json");
const SUBMISSIONS_PATH = path.join(RUNTIME_DIR, "submissions.json");
const AUDIT_PATH = path.join(RUNTIME_DIR, "audit.json");
const REVISIONS_PATH = path.join(RUNTIME_DIR, "revisions.json");
const FEEDBACK_PATH = path.join(RUNTIME_DIR, "feedback.json");

/**
 * Toggle DB mode via environment.
 *
 * When enabled, the service uses `backend/src/db/*` and schema migrations.
 * When disabled, the service reads/writes JSON files under `backend/runtime/`.
 */
const dbEnabled = Boolean(process.env.DATABASE_URL);
if (appConfig.isProduction && !dbEnabled) {
  throw new Error("DATABASE_URL is required in production");
}
if (dbEnabled) await migrate();
if (dbEnabled) await ensureSuperadminInitialized();

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
const feedbackFile = await loadJsonFile<any[]>(FEEDBACK_PATH, []);

/**
 * Ensure every project payload returned by JSON mode has a stable `ai_usage_state`.
 *
 * This keeps the frontend uniform while remaining compatible with legacy fields
 * (`ai_generated`, `human_verified`).
 */
function withAiUsageState(p: any) {
  const next = { ...p, ai_usage_state: normalizeAiUsageState(p) };
  return normalizeProjectTags(next);
}

/**
 * Audit logger wrapper for both DB and JSON mode.
 *
 * In DB mode, persists to the audit table. In JSON mode, appends to runtime `audit.json`.
 */
async function logAuditCompat(input: { actor?: string; action: string; entity_type: string; entity_id?: string; diff?: any }, defaultActor?: string) {
  try {
    const actor = input.actor ?? defaultActor ?? "system";
    const payload = { ...input, actor };
    if (dbEnabled) {
      await logAudit(payload);
      return;
    }
    auditFile.unshift({
      id: randomUUID(),
      actor,
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

function checkOps(user: any, set: any) {
  if (!dbEnabled) return false;
  if (!user || user.role !== 'ops') {
    set.status = 403;
    return true;
  }
  return false;
}

function checkAuth(user: any, set: any) {
  if (!dbEnabled) return false;
  if (!user) {
    set.status = 401;
    return true;
  }
  return false;
}

const storyIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const storyFilePattern = /^[a-zA-Z0-9._-]{1,128}$/;
const storyFileAllowlist = new Set(["meta.json", "content.md"]);

function resolveStoryFile(id: string, filename: string) {
  const safeId = path.basename(id);
  const safeFilename = path.basename(filename);
  if (!storyIdPattern.test(safeId) || !storyFilePattern.test(safeFilename) || !storyFileAllowlist.has(safeFilename)) {
    return null;
  }
  const base = path.resolve(STORIES_DIR);
  const resolved = path.resolve(STORIES_DIR, safeId, safeFilename);
  if (!resolved.startsWith(base + path.sep)) return null;
  return { safeId, safeFilename, resolved };
}

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return null;
}

const allowedOrigins = appConfig.allowedOrigins;
const app = new Elysia()
  .use(cors({
    origin: ({ headers }) => {
      const origin = headers.origin;
      if (!origin) return true;
      return allowedOrigins.includes(origin);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }))
  .use(authPlugin)
  .use(casdoorAuthPlugin)
  .use(localAuthPlugin)
  .onError(({ error, set, request }) => {
    const traceId = crypto.randomUUID();
    console.error(error);
    set.status = 500;
    if (appConfig.isProduction) {
      return { error: { code: "INTERNAL", message: "Internal Server Error", traceId } };
    }
    return { error: { code: "INTERNAL", message: error.message, traceId, path: request.url } };
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
  .post("/api/projects", async ({ set }) => {
    set.status = 410;
    return { error: "Gone" };
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
  .get("/api/feedback", async ({ query }) => {
    const project_name = typeof (query as any)?.project_name === "string" ? String((query as any).project_name) : "";
    const kind = typeof (query as any)?.kind === "string" ? String((query as any).kind) : "";
    const status = typeof (query as any)?.status === "string" ? String((query as any).status) : "";
    const limit = typeof (query as any)?.limit === "string" ? Number((query as any).limit) : undefined;

    if (dbEnabled) {
      return await listFeedback({
        project_name: project_name || undefined,
        kind: kind === "comment" || kind === "bug" ? (kind as any) : undefined,
        status: status === "open" || status === "closed" ? (status as any) : undefined,
        limit
      });
    }

    const items = feedbackFile
      .filter((e: any) => (!project_name ? true : String(e.project_name ?? "") === project_name))
      .filter((e: any) => (!kind ? true : String(e.kind ?? "") === kind))
      .filter((e: any) => {
        if (status === "open") return String(e.status ?? "open") !== "done";
        if (status === "closed") return String(e.status ?? "open") === "done";
        return true;
      })
      .sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return items.slice(0, Math.min(Math.max(limit ?? 100, 1), 200));
  })
  .post("/api/feedback", async ({ body, set, user }) => {
    if (checkAuth(user, set)) return { error: "Unauthorized" };
    const payload: any = body as any;
    const kind = payload?.kind === "bug" ? "bug" : "comment";
    const project_name = String(payload?.project_name ?? "").trim();
    const actor_username = String(payload?.actor?.username ?? "").trim();
    const actor_role = String(payload?.actor?.role ?? "").trim();
    const title = String(payload?.title ?? "").trim();
    const bodyText = String(payload?.body ?? "").trim();
    const labels = sanitizeIssueLabels(payload?.labels ?? []);

    if (!project_name || !actor_username) {
      set.status = 400;
      return { error: "project_name and actor.username are required" };
    }
    if (kind === "bug" && (!title || !bodyText)) {
      set.status = 400;
      return { error: "title and body are required for bug" };
    }
    if (kind === "comment" && !bodyText) {
      set.status = 400;
      return { error: "body is required" };
    }

    if (dbEnabled) {
      const created = await createFeedback({
        project_name,
        kind,
        title: kind === "bug" ? title : "",
        body: bodyText,
        labels: kind === "bug" ? labels : [],
        status: "open",
        actor_username,
        actor_role
      } as any);
      return created;
    }

    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      project_name,
      kind,
      title: kind === "bug" ? title : "",
      body: bodyText,
      labels: kind === "bug" ? labels : [],
      status: "open",
      actor_username,
      actor_role,
      created_at: now,
      updated_at: now
    };
    feedbackFile.unshift(created);
    await saveJsonFile(FEEDBACK_PATH, feedbackFile);
    return created;
  })
  .patch("/api/feedback/:id", async ({ params: { id }, body, set, user }) => {
    if (checkAuth(user, set)) return { error: "Unauthorized" };
    if (user.role !== 'dev' && user.role !== 'ops') {
      set.status = 403;
      return { error: "Forbidden" };
    }
    const payload: any = body as any;
    const status = typeof payload?.status === "string" ? payload.status : undefined;
    const labels = payload?.labels ? sanitizeIssueLabels(payload.labels) : undefined;
    if (status && status !== "open" && status !== "doing" && status !== "done") {
      set.status = 400;
      return { error: "invalid status" };
    }

    if (dbEnabled) {
      const updated = await updateFeedback({ id, status, labels } as any);
      if (!updated) {
        set.status = 404;
        return { error: "Not found" };
      }
      return updated;
    }

    const idx = feedbackFile.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      set.status = 404;
      return { error: "Not found" };
    }
    const before = feedbackFile[idx];
    const next = {
      ...before,
      status: status ?? before.status,
      labels: labels ?? before.labels,
      updated_at: new Date().toISOString()
    };
    feedbackFile[idx] = next;
    await saveJsonFile(FEEDBACK_PATH, feedbackFile);
    return next;
  })
  .post("/api/admin/categories", async ({ body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    const input = body as any;
    if (!input?.name) {
      set.status = 400;
      return { error: "name is required" };
    }
    if (!dbEnabled) {
      const id = randomUUID().replaceAll("-", "").slice(0, 8);
      (data as any).categories.push({ id, name: input.name, description: input.description ?? "", projects: [] });
      await saveJsonFile(DATA_PATH, data);
      await logAuditCompat({ action: "create", entity_type: "category", entity_id: id }, user?.name);
      return { id, name: input.name, description: input.description ?? "", sort_index: 0 };
    }
    const created = await createCategory({ name: input.name, description: input.description, sort_index: input.sort_index });
    await logAuditCompat({ action: "create", entity_type: "category", entity_id: created.id }, user?.name);
    return created;
  })
  .put("/api/admin/categories/:id", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
      await logAuditCompat({ action: "update", entity_type: "category", entity_id: id, diff: { before, after: cat } }, user?.name);
      return { id: cat.id, name: cat.name, description: cat.description, sort_index: 0 };
    }
    const before = await listCategories().then((cs) => cs.find((c) => c.id === id) ?? null);
    const updated = await updateCategory(id, body as any);
    if (!updated) {
      set.status = 404;
      return { error: "Category not found" };
    }
    await logAuditCompat({ action: "update", entity_type: "category", entity_id: id, diff: { before, after: updated } }, user?.name);
    return updated;
  })
  .delete("/api/admin/categories/:id", async ({ params: { id }, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
      await logAuditCompat({ action: "delete", entity_type: "category", entity_id: id, diff: { before: removed } }, user?.name);
      return { success: true };
    }
    const res = await deleteCategory(id);
    await logAuditCompat({ action: "delete", entity_type: "category", entity_id: id }, user?.name);
    return res;
  })
  .post("/api/admin/projects", async ({ body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
        recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation[0] ?? "" : (typeof normalized.recommendation === "string" ? normalized.recommendation : ""),
        ai_usage_state: normalized.ai_usage_state ?? "unknown",
        github_url: normalized.github_url,
        platform_developers: normalized.platform_developers ?? [],
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
      await logAuditCompat({ action: "create", entity_type: "project", entity_id: id }, user?.name);
      return { ...project, id, category_id: cat.id };
    }
    const created = await createProject(normalizeProjectInput(input));
    await logAuditCompat({ action: "create", entity_type: "project", entity_id: created.id }, user?.name);
    return created;
  })
  .put("/api/admin/projects/:id", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
        recommendation: Array.isArray(normalized.recommendation) ? (normalized.recommendation[0] ?? before.recommendation) : (typeof normalized.recommendation === "string" ? normalized.recommendation : before.recommendation),
        ai_usage_state: normalized.ai_usage_state ?? before.ai_usage_state ?? normalizeAiUsageState(before),
        github_url: normalized.github_url,
        platform_developers: normalized.platform_developers ?? before.platform_developers ?? [],
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
      await logAuditCompat({ action: "update", entity_type: "project", entity_id: newId, diff: { before, after: next } }, user?.name);
      return { ...next, id: newId, category_id: foundCat.id };
    }
    const before = await getProjectById(id);
    if (before) await createProjectRevision(id);
    const updated = await updateProject(id, normalizeProjectInput(body as any));
    if (!updated) {
      set.status = 404;
      return { error: "Project not found" };
    }
    await logAuditCompat({ action: "update", entity_type: "project", entity_id: id, diff: { before, after: updated } }, user?.name);
    return updated;
  })
  .delete("/api/admin/projects/:id", async ({ params: { id }, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    if (!dbEnabled) {
      const key = decodeURIComponent(id);
      for (const c of (data as any).categories) {
        const idx = (c.projects ?? []).findIndex((p: any) => String(p.name).toLowerCase() === String(key).toLowerCase());
        if (idx !== -1) {
          const before = c.projects.splice(idx, 1)[0];
          await saveJsonFile(DATA_PATH, data);
          await logAuditCompat({ action: "delete", entity_type: "project", entity_id: id, diff: { before } }, user?.name);
          return { success: true };
        }
      }
      set.status = 404;
      return { error: "Project not found" };
    }
    const before = await getProjectById(id);
    const res = await deleteProject(id);
    await logAuditCompat({ action: "delete", entity_type: "project", entity_id: id, diff: { before } }, user?.name);
    return res;
  })
  .get("/api/admin/categories", async ({ set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    if (!dbEnabled) {
      return (data as any).categories.map((c: any) => ({ id: c.id ?? c.name, name: c.name, description: c.description ?? "", sort_index: 0 }));
    }
    return await listCategories();
  })
  .get("/api/admin/projects", async ({ query, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
  .get("/api/admin/projects/export.json", async ({ set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    if (!dbEnabled) {
      await logAuditCompat({ action: "export_json", entity_type: "project", entity_id: "" }, user?.name);
      return data;
    }
    await logAuditCompat({ action: "export_json", entity_type: "project", entity_id: "" }, user?.name);
    return await getCatalog();
  })
  .get("/api/admin/projects/export.csv", async ({ set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    if (!dbEnabled) {
      await logAuditCompat({ action: "export_csv", entity_type: "project", entity_id: "" }, user?.name);
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
  .post("/api/admin/projects/import.json", async ({ body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
            recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation[0] ?? "" : (typeof normalized.recommendation === "string" ? normalized.recommendation : ""),
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
    async ({ body, set, user }) => {
      if (checkOps(user, set)) return { error: "Forbidden" };
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
            recommendation: Array.isArray(normalized.recommendation) ? normalized.recommendation[0] ?? "" : (typeof normalized.recommendation === "string" ? normalized.recommendation : ""),
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
  .get("/api/admin/audit-logs", async ({ query, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
  .get("/api/admin/projects/:id/revisions", async ({ params: { id }, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    if (!dbEnabled) return revisionsFile[id] ?? [];
    return await listProjectRevisions(id);
  })
  .post("/api/admin/projects/:id/rollback", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
  .post("/api/submissions", async ({ body, set, headers }) => {
    if (checkRateLimit({ headers, path: "/api/submissions", set })) return { error: "Too Many Requests" };
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
  .post("/api/dev/submissions", async ({ body, set, user, headers }) => {
    if (checkRateLimit({ headers, path: "/api/dev/submissions", set })) return { error: "Too Many Requests" };
    if (checkAuth(user, set)) return { error: "Unauthorized" };
    if (!user || (user.role !== "dev" && user.role !== "ops")) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    const payload: any = body as any;
    if (payload?.kind !== "project_update") {
      set.status = 400;
      return { error: "kind must be project_update" };
    }
    if (!payload?.project_name || !payload?.patch) {
      set.status = 400;
      return { error: "project_name, patch are required" };
    }
    payload.actor = { username: user.name, role: user.role };

    if (!dbEnabled) {
      const created = { id: randomUUID(), status: "pending", payload, review_note: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      submissionsFile.unshift(created);
      await saveJsonFile(SUBMISSIONS_PATH, submissionsFile);
      await logAuditCompat({ action: "submit", entity_type: "submission", entity_id: created.id, diff: { kind: "project_update" } });
      return { success: true, submissionId: created.id };
    }

    const created = await createSubmission(payload);
    await logAuditCompat({ action: "submit", entity_type: "submission", entity_id: created.id, diff: { kind: "project_update" } });
    return { success: true, submissionId: created.id };
  })
  .post("/api/submit", async ({ body, set, headers }) => {
    if (checkRateLimit({ headers, path: "/api/submit", set })) return { error: "Too Many Requests" };
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
  .get("/api/admin/submissions", async ({ query, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
  .get("/api/admin/submissions/:id", async ({ params: { id }, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    const item = !dbEnabled ? submissionsFile.find((s: any) => s.id === id) : await getSubmission(id);
    if (!item) {
      set.status = 404;
      return { error: "Submission not found" };
    }
    return item;
  })
  .post("/api/admin/submissions/:id/reject", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
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
  .post("/api/admin/submissions/:id/approve", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    try {
      const submission = !dbEnabled ? submissionsFile.find((s: any) => s.id === id) : await getSubmission(id);
      if (!submission) {
        set.status = 404;
        return { error: "Submission not found" };
      }

      const sp: any = submission.payload ?? {};
      if (sp?.kind === "project_update") {
        const projectName = String(sp.project_name ?? "").trim();
        if (!projectName) {
          set.status = 400;
          return { error: "payload.project_name is required" };
        }
        const patch = sp.patch ?? {};

        if (!dbEnabled) {
          let foundCat: any = null;
          let foundIdx = -1;
          for (const c of (data as any).categories) {
            const idx = (c.projects ?? []).findIndex((p: any) => String(p.name).toLowerCase() === projectName.toLowerCase());
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
          const next = applyProjectPatch(before, patch);

          const revisionsKey = encodeURIComponent(before.name);
          const list = revisionsFile[revisionsKey] ?? [];
          list.unshift({ id: randomUUID(), created_at: new Date().toISOString(), snapshot: before });
          revisionsFile[revisionsKey] = list.slice(0, 20);

          foundCat.projects[foundIdx] = next;
          submission.status = "approved";
          submission.review_note = "";
          submission.updated_at = new Date().toISOString();

          setTimeout(() => {
            void saveJsonFile(REVISIONS_PATH, revisionsFile);
            void saveJsonFile(DATA_PATH, data);
            void saveJsonFile(SUBMISSIONS_PATH, submissionsFile);
          }, 0);

          const projectId = encodeURIComponent(next.name);
          void logAuditCompat({ action: "approve", entity_type: "submission", entity_id: id, diff: { project_id: projectId, kind: "project_update" } });
          void logAuditCompat({ action: "update", entity_type: "project", entity_id: projectId, diff: { before, after: next, from_submission: id } });
          set.headers["content-type"] = "application/json; charset=utf-8";
          return JSON.stringify({ success: true, project_id: projectId });
        }

        const before = await getProjectByKey(projectName);
        if (!before) {
          set.status = 404;
          return { error: "Project not found" };
        }
        await createProjectRevision(before.id);
        const next = await updateProject(before.id, {
          description: typeof patch.description === "string" ? patch.description : undefined,
          keywords: Array.isArray(patch.keywords) ? patch.keywords : typeof patch.keywords === "string" ? patch.keywords.split(/[,，;]/).map((x: any) => String(x).trim()).filter(Boolean) : undefined
        } as any);
        if (!next) {
          set.status = 500;
          return { error: "Update failed" };
        }
        await updateSubmissionStatus(id, "approved", "");
        await logAuditCompat({ action: "approve", entity_type: "submission", entity_id: id, diff: { project_id: before.id, kind: "project_update" } });
        await logAuditCompat({ action: "update", entity_type: "project", entity_id: before.id, diff: { before, after: next, from_submission: id } });
        set.headers["content-type"] = "application/json; charset=utf-8";
        return JSON.stringify({ success: true, project_id: before.id });
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
        recommendation: Array.isArray(projectInput.recommendation) ? projectInput.recommendation[0] ?? "" : (typeof projectInput.recommendation === "string" ? projectInput.recommendation : ""),
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
  .get("/api/stories/:id/:filename", ({ params: { id, filename }, set }) => {
    const resolved = resolveStoryFile(id, filename);
    if (!resolved) {
      set.status = 404;
      return { error: "Not found" };
    }
    return Bun.file(resolved.resolved);
  })
  .post("/api/stories", async ({ body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    // In a real app, we'd save this to the DB/JSON file. For now, we update in-memory and write to file.
    const newStories = body as any;
    
    for (const story of newStories) {
      const safeId = path.basename(String(story.id ?? ""));
      if (!storyIdPattern.test(safeId)) {
        set.status = 400;
        return { error: "invalid story id" };
      }
      const dirPath = path.resolve(STORIES_DIR, safeId);
      if (!dirPath.startsWith(path.resolve(STORIES_DIR) + path.sep)) {
        set.status = 400;
        return { error: "invalid path" };
      }
      await fs.mkdir(dirPath, { recursive: true });
      
      const { content, ...meta } = story;
      
      await fs.writeFile(path.join(dirPath, "meta.json"), JSON.stringify(meta, null, 2));
      await fs.writeFile(path.join(dirPath, "content.md"), content || "");
    }

    return { success: true };
  })
  .get("/api/uploads/:filename", async ({ params: { filename }, set }) => {
    const safe = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safe);
    try {
      await fs.access(filePath);
      set.headers["cache-control"] = "public, max-age=31536000, immutable";
      return Bun.file(filePath);
    } catch {
      set.status = 404;
      return { error: "Not found" };
    }
  })
  .post("/api/upload", async ({ body: { image }, set, user, headers }) => {
    if (checkRateLimit({ headers, path: "/api/upload", set })) return { error: "Too Many Requests" };
    if (checkAuth(user, set)) return { error: "Unauthorized" };
    if (!image) throw new Error("No image provided");
    if (image.size > appConfig.uploadMaxBytes) {
      set.status = 400;
      return { error: "File too large" };
    }
    const mime = String(image.type || "");
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
      set.status = 400;
      return { error: "Unsupported image type" };
    }
    const ext = extFromMime(mime);
    if (!ext) {
      set.status = 400;
      return { error: "Unsupported image type" };
    }
    const buffer = Buffer.from(await image.arrayBuffer());
    const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    if (!(isPng || isJpeg || isWebp)) {
      set.status = 400;
      return { error: "Invalid file signature" };
    }
    const filename = `${crypto.createHash("sha256").update(buffer).digest("hex")}.${ext}`;
    const uploadPath = path.join(UPLOADS_DIR, filename);
    await Bun.write(uploadPath, buffer);
    return { url: `/api/uploads/${filename}` };
  }, {
    body: t.Object({
      image: t.File()
    })
  })
  .get("/api/admin/users", async ({ query, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    const q = typeof query.q === "string" ? query.q : undefined;
    const role = typeof query.role === "string" ? query.role : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    return await listUsers({ q, role, page, pageSize });
  })
  .patch("/api/admin/users/:id/role", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    const role = (body as any)?.role;
    if (!role || !["user", "dev", "ops"].includes(role)) {
      set.status = 400;
      return { error: "Invalid role" };
    }
    const updated = await setUserRole(id, role);
    if (!updated) {
      set.status = 404;
      return { error: "User not found" };
    }
    await logAuditCompat({ action: "update_role", entity_type: "user", entity_id: id, diff: { role } });
    return updated;
  })
  .patch("/api/admin/users/:id/active", async ({ params: { id }, body, set, user }) => {
    if (checkOps(user, set)) return { error: "Forbidden" };
    const isActive = (body as any)?.is_active;
    if (typeof isActive !== "boolean") {
      set.status = 400;
      return { error: "is_active must be boolean" };
    }
    const updated = await setUserActive(id, isActive);
    if (!updated) {
      set.status = 404;
      return { error: "User not found" };
    }
    await logAuditCompat({ action: isActive ? "activate" : "deactivate", entity_type: "user", entity_id: id });
    return updated;
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

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
