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
import { createReply, listReplies } from "./services/feedbackReplies";
import { sanitizeIssueLabels } from "./domain/feedbackLabels";
import { normalizeProjectTags } from "./domain/projectTags";
import {
  createCommentModeration,
  createBugModeration,
  listCommentModeration,
  listBugModeration,
  getCommentModeration,
  getBugModeration,
  updateCommentModerationStatus,
  updateBugModerationStatus,
  setCommentFeedbackEntryId,
  setBugFeedbackEntryId,
} from "./services/contentModeration";
import {
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./services/notifications";
import { authPlugin, requireAuth, requireCapability } from "./plugins/auth";
import { casdoorAuthPlugin } from "./plugins/casdoorAuth";
import { localAuthPlugin } from "./plugins/localAuth";
import { listUsers, setUserRole, setUserActive, updateUserLogin, findUserByName, deleteUser, findUserById, bumpUserTokenVersion, createUser } from "./services/users";
import { ensureSuperadminInitialized, SUPERADMIN_INITIAL_USERNAME, setLocalAccountPassword, validateSuperadminPassword } from "./services/localAccounts";
import { listCapabilities, getUserCapabilitiesWithInfo, setUserCapabilities, isSuperadmin as isSuperadminUser } from "./services/capabilities";
import { getRoleTemplates } from "./services/capabilities";
import { getDashboardData } from "./services/dashboard";
import { createOrGetMediaAssetFromUpload, getMediaReferences, listMediaAssets, restoreMedia, softDeleteMedia, getMediaTags, setMediaTags, batchTagMedia, batchSoftDeleteMedia, upsertMediaReference, upsertMediaReferencesForEntity } from "./services/media";
import { buildKey, writeFile as storageWriteFile, readFile as storageReadFile, publicUrl as storagePublicUrl, ensureRoot } from "./services/storage";
import { appConfig } from "./config";
import { checkRateLimit } from "./plugins/rateLimit";
import { addProjectMember, removeProjectMember, removeProjectOrgMember, getProjectMembers, getUserProjects, isProjectMember, isProjectOwner } from "./services/projectMembers";
import { createOrganization, findOrganizationById, findOrganizationBySlug, listOrganizations, updateOrganization, updateOrganizationStatus, deleteOrganization, getOrganizationMembers, addOrganizationMember, removeOrganizationMember, updateOrganizationMemberRole, getUserOrganizations, isOrgMember, isOrgAdminOrAbove, generateOrgSlug, validateOrgName, type OrganizationStatus } from "./services/organizations";
import { createProjectClaim, listProjectClaims, approveProjectClaim, rejectProjectClaim, type ClaimStatus } from "./services/projectClaims";
import { promoteToDev, demoteFromDev } from "./services/rolePromotion";
import { sql } from "./db/client";

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

await ensureRoot();

const DATA_PATH = path.join(RUNTIME_DIR, "data.json");
const SUBMISSIONS_PATH = path.join(RUNTIME_DIR, "submissions.json");
const AUDIT_PATH = path.join(RUNTIME_DIR, "audit.json");
const REVISIONS_PATH = path.join(RUNTIME_DIR, "revisions.json");
const FEEDBACK_PATH = path.join(RUNTIME_DIR, "feedback.json");
const FEEDBACK_REPLIES_PATH = path.join(RUNTIME_DIR, "feedback_replies.json");

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
// Seed bootstrap superadmin (default username from SUPERADMIN_INITIAL_USERNAME env, "lincube").
// Other ops users are created via the admin UI or scripts/set-user-role.ts.
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
const feedbackRepliesFile = await loadJsonFile<any[]>(FEEDBACK_REPLIES_PATH, []);

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

function apiError(set: any, status: number, code: string, message: string, extra?: Record<string, any>) {
  const traceId = crypto.randomUUID();
  set.status = status;
  return { error: { code, message, traceId, ...(extra ?? {}) } };
}

function apiNotFound(set: any, message = "Not found") {
  return apiError(set, 404, "NOT_FOUND", message);
}

function apiUnauthorized(set: any, message = "Unauthorized") {
  return apiError(set, 401, "UNAUTHORIZED", message);
}

function apiForbidden(set: any, message = "Forbidden") {
  return apiError(set, 403, "FORBIDDEN", message);
}

function apiBadRequest(set: any, message: string) {
  return apiError(set, 400, "BAD_REQUEST", message);
}

function checkAuth(user: any, set: any) {
  if (!dbEnabled) return false;
  if (!user) return apiUnauthorized(set);
  return false;
}

async function checkCap(user: any, set: any, capabilityId: string): Promise<any> {
  if (!dbEnabled) return false;
  if (!user) return apiUnauthorized(set);
  if (isSuperadminUser(user.name)) return false;
  const { userHasCapability } = await import("./services/capabilities");
  const has = await userHasCapability(user.id, user.name, capabilityId);
  if (!has) return apiForbidden(set);
  return false;
}

const storyIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const storyFilePattern = /^[a-zA-Z0-9._-]{1,128}$/;
const storyFileAllowlist = new Set(["meta.json", "content.md"]);
const storyImageExtensions = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"]);

function isStoryImageFile(filename: string) {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return false;
  return storyImageExtensions.has(filename.substring(dot).toLowerCase());
}

function resolveStoryFile(id: string, filename: string) {
  const safeId = path.basename(id);
  const safeFilename = path.basename(filename);
  if (!storyIdPattern.test(safeId) || !storyFilePattern.test(safeFilename) || (!storyFileAllowlist.has(safeFilename) && !isStoryImageFile(safeFilename))) {
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

function uploadError(set: any, status: number, code: string, message: string) {
  set.status = status;
  return { error: message, code, message };
}

function applyPrivateNoStore(set: any) {
  set.headers["cache-control"] = "private, no-store";
  set.headers["vary"] = "Cookie, Authorization";
}

function applyPublicShortCache(set: any, maxAgeSeconds: number) {
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  set.headers["cache-control"] = `public, max-age=${maxAge}, stale-while-revalidate=${Math.max(maxAge, 60)}`;
}

function weakEtagFromJson(payload: unknown) {
  const hash = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  return `W/\"${hash}\"`;
}

function trySendNotModified(headers: Record<string, string | undefined>, set: any, etag: string): boolean {
  const ifNoneMatch = String(headers["if-none-match"] ?? "").trim();
  if (ifNoneMatch && ifNoneMatch === etag) {
    set.status = 304;
    set.headers["etag"] = etag;
    return true;
  }
  set.headers["etag"] = etag;
  return false;
}

async function registerUploadedMedia(input: {
  sha256: string;
  filename: string;
  storageKey: string;
  url: string;
  mime: string;
  size: number;
  source?: string;
  uploaderId?: string | null;
}) {
  return await createOrGetMediaAssetFromUpload({
    sha256: input.sha256,
    storageKey: input.storageKey,
    url: input.url,
    mime: input.mime,
    size: input.size,
    source: input.source,
    uploaderId: input.uploaderId,
  });
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
  .get("/api/health", () => ({ status: "ok", db: dbEnabled, timestamp: new Date().toISOString() }))
  .get("/api/categories", async () => {
    if (!dbEnabled) {
      return data.categories.map((c: any) => ({ id: c.id ?? c.name, name: c.name, description: c.description ?? "" }));
    }
    const catalog = await getCatalog();
    return catalog.categories.map((c: any) => ({ id: c.id, name: c.name, description: c.description }));
  })
  .get("/api/projects", async ({ set, headers }) => {
    applyPublicShortCache(set, 60);
    if (!dbEnabled) {
      const payload = {
        ...data,
        categories: (data.categories ?? []).map((c: any) => ({
          ...c,
          projects: (c.projects ?? []).map(withAiUsageState)
        }))
      };
      const etag = weakEtagFromJson(payload);
      if (trySendNotModified(headers, set, etag)) return;
      return payload;
    }
    const payload = await getCatalog();
    const etag = weakEtagFromJson(payload);
    if (trySendNotModified(headers, set, etag)) return;
    return payload;
  })
  .post("/api/projects", async ({ set }) => {
    set.status = 410;
    return apiError(set, 410, "GONE", "Gone");
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
        return apiNotFound(set, "Project not found");
      }
      return withAiUsageState(project);
    }
    const project = await getProjectByKey(key);
    if (!project) {
      set.status = 404;
      return apiNotFound(set, "Project not found");
    }
    const members = dbEnabled ? await getProjectMembers(project.id) : [];
    return { ...project, developers: members };
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
  .get("/api/feedback", async ({ query, user, set }) => {
    applyPrivateNoStore(set);
    const project_name = typeof (query as any)?.project_name === "string" ? String((query as any).project_name) : "";
    const kind = typeof (query as any)?.kind === "string" ? String((query as any).kind) : "";
    const status = typeof (query as any)?.status === "string" ? String((query as any).status) : "";
    const limit = typeof (query as any)?.limit === "string" ? Number((query as any).limit) : undefined;

    if (dbEnabled) {
      const approvedItems = await listFeedback({
        project_name: project_name || undefined,
        kind: kind === "comment" || kind === "bug" ? (kind as any) : undefined,
        status: status === "open" || status === "closed" ? (status as any) : undefined,
        limit
      });
      if (user?.name) {
        const [pendingComments, pendingBugs] = await Promise.all([
          listCommentModeration({ status: "pending", actor_username: user.name, project_name: project_name || undefined, pageSize: 100 }),
          listBugModeration({ status: "pending", actor_username: user.name, project_name: project_name || undefined, pageSize: 100 }),
        ]);
        const moderatedComments = pendingComments.items.map((m) => ({
          id: `mod-comment-${m.id}`,
          project_name: m.project_name,
          kind: "comment",
          body: m.body,
          actor_username: m.actor_username,
          actor_role: m.actor_role,
          created_at: m.created_at,
          updated_at: m.updated_at,
          moderation_status: m.status,
          moderation_id: m.id,
        }));
        const moderatedBugs = pendingBugs.items.map((m) => ({
          id: `mod-bug-${m.id}`,
          project_name: m.project_name,
          kind: "bug",
          title: m.title,
          body: m.body,
          labels: m.labels,
          status: "open",
          actor_username: m.actor_username,
          actor_role: m.actor_role,
          created_at: m.created_at,
          updated_at: m.updated_at,
          moderation_status: m.status,
          moderation_id: m.id,
        }));
        return [...moderatedComments, ...moderatedBugs, ...approvedItems].sort(
          (a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
        );
      }
      return approvedItems;
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
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
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
      return apiBadRequest(set, "project_name and actor.username are required");
    }
    if (kind === "bug" && (!title || !bodyText)) {
      set.status = 400;
      return apiBadRequest(set, "title and body are required for bug");
    }
    if (kind === "comment" && !bodyText) {
      set.status = 400;
      return apiBadRequest(set, "body is required");
    }

    if (dbEnabled) {
      if (kind === "comment") {
        const created = await createCommentModeration({
          project_name,
          body: bodyText,
          actor_username,
          actor_role,
        });
        return { success: true, moderationId: created?.id, status: "pending", message: "璇勮宸叉彁浜わ紝绛夊緟瀹℃牳" };
      }
      const created = await createBugModeration({
        project_name,
        title,
        body: bodyText,
        labels,
        actor_username,
        actor_role,
      });
      return { success: true, moderationId: created?.id, status: "pending", message: "Bug鍙嶉宸叉彁浜わ紝绛夊緟瀹℃牳" };
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
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const payload: any = body as any;
    const status = typeof payload?.status === "string" ? payload.status : undefined;
    const labels = payload?.labels ? sanitizeIssueLabels(payload.labels) : undefined;
    if (status && status !== "open" && status !== "doing" && status !== "done") {
      set.status = 400;
      return apiBadRequest(set, "invalid status");
    }

    if (dbEnabled) {
      const target = await sql()`select actor_username from feedback_entries where id = ${id}`;
      const actorUsername = target?.[0]?.actor_username ?? '';
      const canManage = user?.role === 'dev' || user?.role === 'ops' || user?.name === actorUsername;
      if (!canManage) {
        set.status = 403;
        return apiForbidden(set);
      }
      const updated = await updateFeedback({ id, status, labels } as any);
      if (!updated) {
        set.status = 404;
        return apiNotFound(set);
      }
      return updated;
    }

    const idx = feedbackFile.findIndex((e: any) => e.id === id);
    if (idx === -1) {
      set.status = 404;
      return apiNotFound(set);
    }
    const before = feedbackFile[idx];
    const canManage = user?.role === 'dev' || user?.role === 'ops' || user?.name === before.actor_username;
    if (!canManage) {
      set.status = 403;
      return apiForbidden(set);
    }
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
  .get("/api/feedback/:id/replies", async ({ params: { id }, set }) => {
    applyPrivateNoStore(set);
    if (dbEnabled) {
      return await listReplies(id);
    }
    return feedbackRepliesFile
      .filter((r: any) => String(r.feedback_id ?? '') === id)
      .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  })
  .post("/api/feedback/:id/replies", async ({ params: { id }, body, set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const payload: any = body as any;
    const bodyText = String(payload?.body ?? '').trim();
    const actor_username = String(payload?.actor?.username ?? user?.name ?? '').trim();
    const actor_role = String(payload?.actor?.role ?? user?.role ?? '').trim();

    if (!bodyText) {
      set.status = 400;
      return apiBadRequest(set, "body is required");
    }

    if (dbEnabled) {
      const created = await createReply({
        feedback_id: id,
        body: bodyText,
        actor_username,
        actor_role
      });
      return created;
    }

    const now = new Date().toISOString();
    const created = {
      id: randomUUID(),
      feedback_id: id,
      body: bodyText,
      actor_username,
      actor_role,
      created_at: now,
      updated_at: now
    };
    feedbackRepliesFile.unshift(created);
    await saveJsonFile(FEEDBACK_REPLIES_PATH, feedbackRepliesFile);
    return created;
  })
  .post("/api/admin/categories", async ({ body, set, user }) => {
    const capErr = await checkCap(user, set, "category:manage");
    if (capErr) return capErr;
    const input = body as any;
    if (!input?.name) {
      set.status = 400;
      return apiBadRequest(set, "name is required");
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
    const capErr = await checkCap(user, set, "category:manage");
    if (capErr) return capErr;
    if (!dbEnabled) {
      const cat = (data as any).categories.find((c: any) => String(c.id) === String(id));
      if (!cat) {
        set.status = 404;
        return apiNotFound(set, "Category not found");
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
      return apiNotFound(set, "Category not found");
    }
    await logAuditCompat({ action: "update", entity_type: "category", entity_id: id, diff: { before, after: updated } }, user?.name);
    return updated;
  })
  .delete("/api/admin/categories/:id", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "category:manage");
    if (capErr) return capErr;
    if (!dbEnabled) {
      const idx = (data as any).categories.findIndex((c: any) => String(c.id) === String(id));
      if (idx === -1) {
        set.status = 404;
        return apiNotFound(set, "Category not found");
      }
      const removed = (data as any).categories.splice(idx, 1)[0];
      let uncat = (data as any).categories.find((c: any) => String(c.id) === "uncat");
      if (!uncat) {
        uncat = { id: "uncat", name: "Uncategorized", description: "", projects: [] };
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
    const capErr = await checkCap(user, set, "project:create");
    if (capErr) return capErr;
    const input = body as any;
    if (!input?.name) {
      set.status = 400;
      return apiBadRequest(set, "name is required");
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
    await upsertMediaReferencesForEntity({ entityType: "project", entityId: created.id, fields: buildProjectMediaFields(normalizeProjectInput(input)) });
    await logAuditCompat({ action: "create", entity_type: "project", entity_id: created.id }, user?.name);
    return created;
  })
  .put("/api/admin/projects/:id", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "project:update");
    if (capErr) return capErr;
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
        return apiNotFound(set, "Project not found");
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
      return apiNotFound(set, "Project not found");
    }
    await upsertMediaReferencesForEntity({ entityType: "project", entityId: id, fields: buildProjectMediaFields(normalizeProjectInput(body as any)) });
    await logAuditCompat({ action: "update", entity_type: "project", entity_id: id, diff: { before, after: updated } }, user?.name);
    return updated;
  })
  .delete("/api/admin/projects/:id", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "project:delete");
    if (capErr) return capErr;
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
      return apiNotFound(set, "Project not found");
    }
    const before = await getProjectById(id);
    const res = await deleteProject(id);
    await logAuditCompat({ action: "delete", entity_type: "project", entity_id: id, diff: { before } }, user?.name);
    return res;
  })
  .get("/api/admin/categories", async ({ set, user }) => {
    const capErr = await checkCap(user, set, "category:manage");
    if (capErr) return capErr;
    if (!dbEnabled) {
      return (data as any).categories.map((c: any) => ({ id: c.id ?? c.name, name: c.name, description: c.description ?? "", sort_index: 0 }));
    }
    return await listCategories();
  })
  .get("/api/admin/projects", async ({ query, set, user }) => {
    const capErr = await checkCap(user, set, "project:read");
    if (capErr) return capErr;
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
  .get("/api/admin/projects/:id", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "project:read");
    if (capErr) return capErr;
    if (!dbEnabled) return apiNotFound(set, "Project not found");
    const project = await getProjectById(id);
    if (!project) return apiNotFound(set, "Project not found");
    const members = await getProjectMembers(id);
    return { ...project, members };
  })
  .get("/api/admin/projects/export.json", async ({ set, user }) => {
    const capErr = await checkCap(user, set, "project:export");
    if (capErr) return capErr;
    if (!dbEnabled) {
      await logAuditCompat({ action: "export_json", entity_type: "project", entity_id: "" }, user?.name);
      return data;
    }
    await logAuditCompat({ action: "export_json", entity_type: "project", entity_id: "" }, user?.name);
    return await getCatalog();
  })
  .get("/api/admin/projects/export.csv", async ({ set, user }) => {
    const capErr = await checkCap(user, set, "project:export");
    if (capErr) return capErr;
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
    const capErr = await checkCap(user, set, "project:import");
    if (capErr) return capErr;
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
        return apiBadRequest(set, "No projects found in payload");
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
      const capErr = await checkCap(user, set, "project:import");
    if (capErr) return capErr;
      const file = (body as any).file as File | undefined;
      if (!file) {
        set.status = 400;
        return apiBadRequest(set, "file is required");
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
  .get("/api/admin/dashboard", async ({ user, set }) => {
    const capErr = await checkCap(user, set, "admin_panel_access");
    if (capErr) return capErr;
    const data = await getDashboardData(String(user!.id), user!.name);
    return data;
  })
  .get("/api/admin/role-templates", async ({ user, set }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    return getRoleTemplates();
  })
  .get("/api/admin/audit-logs", async ({ query, set, user }) => {
    const capErr = await checkCap(user, set, "audit:read");
    if (capErr) return capErr;
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
    const capErr = await checkCap(user, set, "project:read");
    if (capErr) return capErr;
    if (!dbEnabled) return revisionsFile[id] ?? [];
    return await listProjectRevisions(id);
  })
  .post("/api/admin/projects/:id/rollback", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "project:rollback");
    if (capErr) return capErr;
    const revisionId = (body as any)?.revisionId;
    if (!revisionId) {
      set.status = 400;
      return apiBadRequest(set, "revisionId is required");
    }
    if (!dbEnabled) {
      const key = decodeURIComponent(id);
      const list = revisionsFile[id] ?? [];
      const entry = list.find((r: any) => r.id === revisionId);
      if (!entry) {
        set.status = 404;
        return apiNotFound(set, "Revision not found");
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
      return apiNotFound(set, "Project not found");
    }
    const before = await getProjectById(id);
    const updated = await rollbackProject(id, revisionId);
    if (!updated) {
      set.status = 404;
      return apiNotFound(set, "Revision not found");
    }
    await logAuditCompat({ action: "rollback", entity_type: "project", entity_id: id, diff: { before, after: updated, revisionId } });
    return updated;
  })
  .post("/api/submissions", async ({ body, set, headers, user }) => {
    if (checkRateLimit({ headers, path: "/api/submissions", set })) return apiError(set, 429, "RATE_LIMITED", "Too Many Requests");
    const payload: any = body as any;
    if (!payload?.name || !payload?.developer || !payload?.github_url) {
      set.status = 400;
      return apiBadRequest(set, "name, developer, github_url are required");
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
    if (dbEnabled && user) {
      const newProject = await sql()<Array<{ id: string }>>`select id from projects where slug = ${payload.name ?? payload.slug} order by created_at desc limit 1`;
      if (newProject.length) {
        await addProjectMember({ project_id: newProject[0].id, user_id: user.id, role: "owner" });
        await promoteToDev(user.id);
      }
    }
    return { success: true, submissionId: created.id };
  })
  .post("/api/dev/submissions", async ({ body, set, user, headers }) => {
    if (checkRateLimit({ headers, path: "/api/dev/submissions", set })) return apiError(set, 429, "RATE_LIMITED", "Too Many Requests");
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    const payload: any = body as any;
    if (payload?.kind !== "project_update") {
      set.status = 400;
      return apiBadRequest(set, "kind must be project_update");
    }
    if (!payload?.project_name || !payload?.patch) {
      set.status = 400;
      return apiBadRequest(set, "project_name, patch are required");
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
  .get("/api/dev/projects", async ({ user, set, query }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const projects = await getUserProjects(user.id);
    const projectIds = projects.map(p => p.project_id);
    if (projectIds.length === 0) return { items: [], page: 1, pageSize: 20, total: 0 };
    const page = Math.max(1, Number((query as any)?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((query as any)?.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const idList = projectIds.map(id => `'${id}'`).join(",");
    const items = await sql().unsafe(
      `select id, slug, name, developer, description, icon, banner, stars, language, status, updated_at from projects where id in (${idList}) order by updated_at desc limit ${pageSize} offset ${offset}`
    );
    return { items, page, pageSize, total: projects.length };
  })
  .get("/api/dev/projects/:id", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const member = await isProjectMember(id, user.id);
    if (!member) return apiForbidden(set, "Not a project member");
    const project = await getProjectById(id);
    if (!project) return apiNotFound(set, "Project not found");
    const members = await getProjectMembers(id);
    return { ...project, members };
  })
  .patch("/api/dev/projects/:id", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:project_edit");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const member = await isProjectMember(id, user.id);
    if (!member) return apiForbidden(set, "Not a project member");
    const payload = body as any;
    const allowedFields = ["name", "description", "icon", "banner", "github_url", "language", "status", "version", "keywords"];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (payload?.[field] !== undefined) updates[field] = payload[field];
    }
    if (Object.keys(updates).length === 0) return apiBadRequest(set, "No valid fields to update");
    const updated = await updateProject(id, updates);
    if (!updated) return apiNotFound(set, "Project not found");
    await logAuditCompat({ actor: user.name, action: "update", entity_type: "project", entity_id: id, diff: updates });
    return updated;
  })
  .get("/api/dev/projects/:id/members", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const member = await isProjectMember(id, user.id);
    if (!member) return apiForbidden(set, "Not a project member");
    return getProjectMembers(id);
  })
  .post("/api/dev/projects/:id/members", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const isOwner = await isProjectOwner(id, user.id);
    if (!isOwner) return apiForbidden(set, "Only project owner can invite members");
    const payload = body as any;
    if (!payload?.user_id) return apiBadRequest(set, "user_id is required");
    const result = await addProjectMember({ project_id: id, user_id: payload.user_id, role: payload.role ?? "collaborator" });
    await promoteToDev(payload.user_id);
    await logAuditCompat({ actor: user.name, action: "add_member", entity_type: "project", entity_id: id, diff: { user_id: payload.user_id } });
    return result;
  })
  .delete("/api/dev/projects/:id/members/:userId", async ({ params: { id, userId }, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const isOwner = await isProjectOwner(id, user.id);
    if (!isOwner) return apiForbidden(set, "Only project owner can remove members");
    const removed = await removeProjectMember(id, userId);
    if (!removed) return apiBadRequest(set, "Cannot remove member");
    await demoteFromDev(userId);
    await logAuditCompat({ actor: user.name, action: "remove_member", entity_type: "project", entity_id: id, diff: { user_id: userId } });
    return { ok: true };
  })
  .get("/api/dev/feedback", async ({ user, set, query }) => {
    const capErr = await checkCap(user, set, "dev:bug_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const userProjects = await getUserProjects(user.id);
    const projectIds = userProjects.map(p => p.project_id);
    if (projectIds.length === 0) return { items: [], page: 1, pageSize: 20, total: 0 };
    const projectNames: string[] = [];
    for (const pid of projectIds) {
      const p = await getProjectById(pid);
      if (p) projectNames.push(p.slug);
    }
    const kind = (query as any)?.kind === "bug" ? "bug" : undefined;
    const status = (query as any)?.status || undefined;
    const page = Math.max(1, Number((query as any)?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((query as any)?.pageSize) || 20));
    const result = await listFeedback({ project_names: projectNames, kind, status, page, pageSize });
    return result;
  })
  .patch("/api/dev/feedback/:id", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:bug_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const payload = body as any;
    const feedback = await listFeedback({ ids: [id], page: 1, pageSize: 1 });
    if (!(feedback as any).items?.length) return apiNotFound(set, "Feedback not found");
    const fb = (feedback as any).items[0];
    const userProjects = await getUserProjects(user.id);
    const projectIds = new Set(userProjects.map(p => p.project_id));
    const project = await sql()<Array<{ id: string }>>`select id from projects where slug = ${fb.project_name} limit 1`;
    if (!project.length || !projectIds.has(project[0].id)) return apiForbidden(set, "Not a project member");
    const updated = await updateFeedback({ id, status: payload?.status, labels: payload?.labels });
    return updated;
  })
  .post("/api/dev/feedback/:id/replies", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:bug_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const payload = body as any;
    if (!payload?.body) return apiBadRequest(set, "body is required");
    const reply = await createReply({ feedback_id: id, body: payload.body, actor_username: user.name, actor_role: user.role ?? "dev" });
    return reply;
  })
  .get("/api/dev/comments", async ({ user, set, query }) => {
    const capErr = await checkCap(user, set, "dev:comment_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const userProjects = await getUserProjects(user.id);
    const projectIds = userProjects.map(p => p.project_id);
    if (projectIds.length === 0) return { items: [], page: 1, pageSize: 20, total: 0 };
    const projectNames: string[] = [];
    for (const pid of projectIds) {
      const p = await getProjectById(pid);
      if (p) projectNames.push(p.slug);
    }
    const page = Math.max(1, Number((query as any)?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((query as any)?.pageSize) || 20));
    const result = await listFeedback({ project_names: projectNames, kind: "comment", page, pageSize });
    return result;
  })
  .delete("/api/dev/comments/:id", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "dev:comment_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const feedback = await listFeedback({ ids: [id], page: 1, pageSize: 1 });
    if (!(feedback as any).items?.length) return apiNotFound(set, "Comment not found");
    const fb = (feedback as any).items[0];
    const userProjects = await getUserProjects(user.id);
    const projectIds = new Set(userProjects.map(p => p.project_id));
    const project = await sql()<Array<{ id: string }>>`select id from projects where slug = ${fb.project_name} limit 1`;
    if (!project.length || !projectIds.has(project[0].id)) return apiForbidden(set, "Not a project member");
    await sql()`delete from feedback_entries where id = ${id}`;
    await logAuditCompat({ actor: user.name, action: "delete", entity_type: "comment", entity_id: id });
    return { ok: true };
  })
  .post("/api/dev/comments/:id/replies", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:comment_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const payload = body as any;
    if (!payload?.body) return apiBadRequest(set, "body is required");
    const reply = await createReply({ feedback_id: id, body: payload.body, actor_username: user.name, actor_role: user.role ?? "dev" });
    return reply;
  })
  .get("/api/dev/stats", async ({ user, set }) => {
    const capErr = await checkCap(user, set, "dev:stats_view");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const userProjects = await getUserProjects(user.id);
    const projectIds = userProjects.map(p => p.project_id);
    if (projectIds.length === 0) return { projects: 0, totalBugs: 0, openBugs: 0, totalComments: 0 };
    const idList = projectIds.map(id => `'${id}'`).join(",");
    const projects = await sql().unsafe(`select id, slug, name, stars from projects where id in (${idList})`);
    const projectNames = projects.map((p: any) => p.slug);
    const nameList = projectNames.map((n: string) => `'${n}'`).join(",");
    const [{ total_bugs }] = await sql().unsafe(`select count(*)::text as total_bugs from feedback_entries where project_name in (${nameList}) and kind = 'bug'`) as Array<{ total_bugs: string }>;
    const [{ open_bugs }] = await sql().unsafe(`select count(*)::text as open_bugs from feedback_entries where project_name in (${nameList}) and kind = 'bug' and status = 'open'`) as Array<{ open_bugs: string }>;
    const [{ total_comments }] = await sql().unsafe(`select count(*)::text as total_comments from feedback_entries where project_name in (${nameList}) and kind = 'comment'`) as Array<{ total_comments: string }>;
    return { projects: projectIds.length, totalBugs: Number(total_bugs), openBugs: Number(open_bugs), totalComments: Number(total_comments) };
  })
  .get("/api/dev/organizations", async ({ user, set }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    return getUserOrganizations(user.id);
  })
  .post("/api/dev/organizations", async ({ body, user, set }) => {
    const capErr = await checkCap(user, set, "user:create_org");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const payload = body as any;
    if (!payload?.name) return apiBadRequest(set, "name is required");
    if (!validateOrgName(payload.name)) return apiBadRequest(set, "Invalid organization name");
    const slug = payload.slug ?? generateOrgSlug(payload.name);
    const existing = await findOrganizationBySlug(slug);
    if (existing) return apiBadRequest(set, "Slug already taken");
    const org = await createOrganization({ name: payload.name, slug, description: payload.description, website_url: payload.website_url, created_by: user.id });
    await logAuditCompat({ actor: user.name, action: "create", entity_type: "organization", entity_id: org.id, diff: { name: payload.name, slug } });
    return org;
  })
  .get("/api/dev/organizations/:id", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const org = await findOrganizationById(id);
    if (!org) return apiNotFound(set, "Organization not found");
    const isAdmin = await isOrgAdminOrAbove(id, user.id);
    const memberCheck = await isOrgMember(id, user.id);
    if (!memberCheck && org.status !== "approved") return apiForbidden(set, "Not a member");
    const members = await getOrganizationMembers(id);
    return { ...org, members, is_admin: isAdmin };
  })
  .patch("/api/dev/organizations/:id", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const isAdmin = await isOrgAdminOrAbove(id, user.id);
    if (!isAdmin) return apiForbidden(set, "Only owner/admin can edit organization");
    const payload = body as any;
    const updated = await updateOrganization(id, { name: payload?.name, description: payload?.description, website_url: payload?.website_url, avatar_url: payload?.avatar_url });
    if (!updated) return apiNotFound(set, "Organization not found");
    return updated;
  })
  .get("/api/dev/organizations/:id/members", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const memberCheck = await isOrgMember(id, user.id);
    if (!memberCheck) return apiForbidden(set, "Not a member");
    return getOrganizationMembers(id);
  })
  .post("/api/dev/organizations/:id/members", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const isAdmin = await isOrgAdminOrAbove(id, user.id);
    if (!isAdmin) return apiForbidden(set, "Only owner/admin can invite members");
    const payload = body as any;
    if (!payload?.user_id) return apiBadRequest(set, "user_id is required");
    const result = await addOrganizationMember({ org_id: id, user_id: payload.user_id, role: payload.role ?? "member" });
    await promoteToDev(payload.user_id);
    return result;
  })
  .delete("/api/dev/organizations/:id/members/:userId", async ({ params: { id, userId }, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const isAdmin = await isOrgAdminOrAbove(id, user.id);
    if (!isAdmin) return apiForbidden(set, "Only owner/admin can remove members");
    const removed = await removeOrganizationMember(id, userId);
    if (!removed) return apiBadRequest(set, "Cannot remove member");
    await demoteFromDev(userId);
    return { ok: true };
  })
  .patch("/api/dev/organizations/:id/members/:userId", async ({ params: { id, userId }, body, user, set }) => {
    const capErr = await checkCap(user, set, "dev:member_manage");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const isOrgOwner = await sql()<Array<{ role: string }>>`select role from organization_members where org_id = ${id} and user_id = ${user.id} and role = 'owner'`;
    if (!isOrgOwner.length) return apiForbidden(set, "Only owner can change member roles");
    const payload = body as any;
    if (!payload?.role || !["admin", "member"].includes(payload.role)) return apiBadRequest(set, "Invalid role");
    const result = await updateOrganizationMemberRole(id, userId, payload.role);
    if (!result) return apiBadRequest(set, "Cannot update role");
    return result;
  })
  .post("/api/dev/project-claims", async ({ body, user, set }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const payload = body as any;
    if (!payload?.project_id) return apiBadRequest(set, "project_id is required");
    const existing = await isProjectMember(payload.project_id, user.id);
    if (existing) return apiBadRequest(set, "Already a project member");
    const claim = await createProjectClaim({ project_id: payload.project_id, user_id: user.id, message: payload.message });
    return claim;
  })
  .get("/api/dev/project-claims", async ({ user, set, query }) => {
    const capErr = await checkCap(user, set, "dev_panel_access");
    if (capErr) return capErr;
    if (!user) return apiUnauthorized(set);
    const page = Math.max(1, Number((query as any)?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((query as any)?.pageSize) || 20));
    return listProjectClaims({ user_id: user.id, page, pageSize });
  })
  .post("/api/submit", async ({ body, set, headers }) => {
    if (checkRateLimit({ headers, path: "/api/submit", set })) return apiError(set, 429, "RATE_LIMITED", "Too Many Requests");
    const payload: any = body as any;
    if (!payload?.name || !payload?.developer || !payload?.github_url) {
      set.status = 400;
      return apiBadRequest(set, "name, developer, github_url are required");
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
    const capErr = await checkCap(user, set, "submission:read");
    if (capErr) return capErr;
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
    const capErr = await checkCap(user, set, "submission:read");
    if (capErr) return capErr;
    const item = !dbEnabled ? submissionsFile.find((s: any) => s.id === id) : await getSubmission(id);
    if (!item) {
      set.status = 404;
      return apiNotFound(set, "Submission not found");
    }
    return item;
  })
  .post("/api/admin/submissions/:id/reject", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "submission:reject");
    if (capErr) return capErr;
    const note = String((body as any)?.review_note ?? "");
    if (!dbEnabled) {
      const s = submissionsFile.find((x: any) => x.id === id);
      if (!s) {
        set.status = 404;
        return apiNotFound(set, "Submission not found");
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
      return apiNotFound(set, "Submission not found");
    }
    await logAuditCompat({ action: "reject", entity_type: "submission", entity_id: id, diff: { review_note: note } });
    return { success: true };
  })
  .post("/api/admin/submissions/:id/approve", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "submission:approve");
    if (capErr) return capErr;
    try {
      const submission = !dbEnabled ? submissionsFile.find((s: any) => s.id === id) : await getSubmission(id);
      if (!submission) {
        set.status = 404;
        return apiNotFound(set, "Submission not found");
      }

      const sp: any = submission.payload ?? {};
      if (sp?.kind === "project_update") {
        const projectName = String(sp.project_name ?? "").trim();
        if (!projectName) {
          set.status = 400;
          return apiBadRequest(set, "payload.project_name is required");
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
            return apiNotFound(set, "Project not found");
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
          return apiNotFound(set, "Project not found");
        }
        await createProjectRevision(before.id);
        const next = await updateProject(before.id, {
          description: typeof patch.description === "string" ? patch.description : undefined,
          keywords: Array.isArray(patch.keywords) ? patch.keywords : typeof patch.keywords === "string" ? patch.keywords.split(/[,锛?]/).map((x: any) => String(x).trim()).filter(Boolean) : undefined
        } as any);
        if (!next) {
          set.status = 500;
          return apiError(set, 500, "UPDATE_FAILED", "Update failed");
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
        return apiBadRequest(set, "project.name is required");
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
        return apiError(set, 500, "TARGET_CATEGORY_INVALID", "Target category invalid");
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
      await upsertMediaReferencesForEntity({ entityType: "project", entityId: createdProject.id, fields: buildProjectMediaFields(projectInput) });
      await updateSubmissionStatus(id, "approved", "");
      await logAuditCompat({ action: "approve", entity_type: "submission", entity_id: id, diff: { project_id: createdProject.id } });
      await logAuditCompat({ action: "create", entity_type: "project", entity_id: createdProject.id, diff: { from_submission: id } });
      set.headers["content-type"] = "application/json; charset=utf-8";
      return JSON.stringify({ success: true, project_id: createdProject.id });
    } catch (e: any) {
      set.status = 500;
      return apiError(set, 500, "INTERNAL", e?.message ?? String(e));
    }
  })
  .get("/api/stories", async ({ set, headers }) => {
    applyPublicShortCache(set, 30);
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
      const etag = weakEtagFromJson(stories);
      if (trySendNotModified(headers, set, etag)) return;
      return stories;
    } catch (err) {
      const fallback: any[] = [];
      const etag = weakEtagFromJson(fallback);
      if (trySendNotModified(headers, set, etag)) return;
      return fallback;
    }
  })
  .get("/api/stories/:id/:filename", ({ params: { id, filename }, set }) => {
    const resolved = resolveStoryFile(id, filename);
    if (!resolved) {
      set.status = 404;
      return apiNotFound(set);
    }
    return Bun.file(resolved.resolved);
  })
  .post("/api/stories", async ({ body, set, user }) => {
    const capErr = await checkCap(user, set, "story:manage");
    if (capErr) return capErr;
    const newStories = body as any;
    
    for (const story of newStories) {
      const safeId = path.basename(String(story.id ?? ""));
      if (!storyIdPattern.test(safeId)) {
        set.status = 400;
        return apiBadRequest(set, "invalid story id");
      }
      const dirPath = path.resolve(STORIES_DIR, safeId);
      if (!dirPath.startsWith(path.resolve(STORIES_DIR) + path.sep)) {
        set.status = 400;
        return apiBadRequest(set, "invalid path");
      }
      await fs.mkdir(dirPath, { recursive: true });
      
      const { content, ...meta } = story;
      
      await fs.writeFile(path.join(dirPath, "meta.json"), JSON.stringify(meta, null, 2));
      await fs.writeFile(path.join(dirPath, "content.md"), content || "");

      if (meta.cover && dbEnabled) {
        await upsertMediaReferencesForEntity({
          entityType: "story",
          entityId: safeId,
          fields: [{ url: meta.cover, fieldPath: "cover" }],
        });
      }
    }

    return { success: true };
  })
  .get("/api/uploads/:filename", async ({ params: { filename }, set }) => {
    const key = path.basename(filename);
    const file = await storageReadFile(key);
    if (!(await file.exists())) {
      set.status = 404;
      return apiNotFound(set);
    }
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return file;
  })
  .post("/api/upload", async ({ body: { image }, set, user, headers }) => {
    if (checkRateLimit({ headers, path: "/api/upload", set })) {
      return uploadError(set, 429, "UPLOAD_RATE_LIMITED", "请求过于频繁，请稍后重试");
    }
    const authErr = checkAuth(user, set);
    if (authErr) return uploadError(set, 401, "UPLOAD_UNAUTHORIZED", "请先登录后再上传");
    if (!image) return uploadError(set, 400, "UPLOAD_MISSING_FILE", "未检测到上传文件");
    if (image.size > appConfig.uploadMaxBytes) {
      return uploadError(set, 400, "UPLOAD_FILE_TOO_LARGE", `图片大小超过限制（最大 ${Math.round(appConfig.uploadMaxBytes / (1024 * 1024))}MB）`);
    }
    const mime = String(image.type || "");
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
      return uploadError(set, 400, "UPLOAD_UNSUPPORTED_TYPE", "仅支持 PNG、JPG、WEBP 格式");
    }
    const ext = extFromMime(mime);
    if (!ext) {
      return uploadError(set, 400, "UPLOAD_UNSUPPORTED_TYPE", "仅支持 PNG、JPG、WEBP 格式");
    }
    const buffer = Buffer.from(await image.arrayBuffer());
    const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    if (!(isPng || isJpeg || isWebp)) {
      return uploadError(set, 400, "UPLOAD_INVALID_SIGNATURE", "文件内容与图片格式不匹配");
    }
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const filename = `${hash}.${ext}`;
    const key = buildKey(filename);
    await storageWriteFile(key, buffer);
    const url = storagePublicUrl(key);
    const media = await registerUploadedMedia({
      sha256: hash,
      filename,
      storageKey: key,
      url,
      mime,
      size: buffer.length,
      source: "upload",
      uploaderId: user?.id,
    });
    return { url, media_id: media?.id, storage_key: key };
  }, {
    body: t.Object({
      image: t.File()
    })
  })
  .post("/api/user/avatar", async ({ body: { image }, set, user, headers }) => {
    if (checkRateLimit({ headers, path: "/api/user/avatar", set })) {
      return uploadError(set, 429, "UPLOAD_RATE_LIMITED", "请求过于频繁，请稍后重试");
    }
    const authErr = checkAuth(user, set);
    if (authErr) return uploadError(set, 401, "UPLOAD_UNAUTHORIZED", "请先登录后再上传");
    if (!image) return uploadError(set, 400, "UPLOAD_MISSING_FILE", "未检测到上传文件");
    if (image.size > appConfig.uploadMaxBytes) {
      return uploadError(set, 400, "UPLOAD_FILE_TOO_LARGE", `图片大小超过限制（最大 ${Math.round(appConfig.uploadMaxBytes / (1024 * 1024))}MB）`);
    }
    const mime = String(image.type || "");
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
      return uploadError(set, 400, "UPLOAD_UNSUPPORTED_TYPE", "仅支持 PNG、JPG、WEBP 格式");
    }
    const ext = extFromMime(mime);
    if (!ext) {
      return uploadError(set, 400, "UPLOAD_UNSUPPORTED_TYPE", "仅支持 PNG、JPG、WEBP 格式");
    }
    const buffer = Buffer.from(await image.arrayBuffer());
    const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    if (!(isPng || isJpeg || isWebp)) {
      return uploadError(set, 400, "UPLOAD_INVALID_SIGNATURE", "文件内容与图片格式不匹配");
    }
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const filename = `${hash}.${ext}`;
    const key = buildKey(filename);
    await storageWriteFile(key, buffer);
    const avatarUrl = storagePublicUrl(key);
    const media = await registerUploadedMedia({
      sha256: hash,
      filename,
      storageKey: key,
      url: avatarUrl,
      mime,
      size: buffer.length,
      source: "avatar",
      uploaderId: user?.id,
    });

    // Update user's avatar in database
    if (user?.id && !String(user.id).startsWith("local:")) {
      await updateUserLogin(user.id, {
        avatar_url: avatarUrl,
        avatar_source: "upload",
      });
    }

    if (media?.id && user?.id) {
      await upsertMediaReference({
        mediaId: media.id,
        entityType: "user",
        entityId: String(user.id),
        fieldPath: "avatar",
      });
    }

    return { url: avatarUrl, media_id: media?.id, storage_key: key };
  }, {
    body: t.Object({
      image: t.File()
    })
  })
  .get("/api/admin/media", async ({ query, set, user }) => {
    const capErr = await checkCap(user, set, "media:read");
    if (capErr) return capErr;
    const q = typeof query.q === "string" ? query.q : undefined;
    const status = typeof query.status === "string" ? query.status : undefined;
    const mime = typeof query.mime === "string" ? query.mime : undefined;
    const source = typeof query.source === "string" ? query.source : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    return await listMediaAssets({ q, status, mime, source }, { page, pageSize });
  })
  .get("/api/admin/media/:id/references", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "media:read");
    if (capErr) return capErr;
    return { items: await getMediaReferences(id) };
  })
  .delete("/api/admin/media/:id", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "media:manage");
    if (capErr) return capErr;
    const updated = await softDeleteMedia(id);
    if (!updated) {
      set.status = 404;
      return apiNotFound(set, "Media not found");
    }
    await logAuditCompat({ action: "soft_delete_media", entity_type: "media", entity_id: id }, user?.name);
    return updated;
  })
  .post("/api/admin/media/:id/restore", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "media:manage");
    if (capErr) return capErr;
    const updated = await restoreMedia(id);
    if (!updated) {
      set.status = 404;
      return apiNotFound(set, "Media not found");
    }
    await logAuditCompat({ action: "restore_media", entity_type: "media", entity_id: id }, user?.name);
    return updated;
  })
  .get("/api/admin/media/:id/tags", async ({ user, set, params }) => {
    const capErr = await checkCap(user, set, "media:read");
    if (capErr) return capErr;
    const tags = await getMediaTags(String(params.id));
    return { tags };
  })
  .patch("/api/admin/media/:id/tags", async ({ user, set, params, body }) => {
    const capErr = await checkCap(user, set, "media:manage");
    if (capErr) return capErr;
    const tags = await setMediaTags(String(params.id), body.tags as string[]);
    return { tags };
  }, {
    body: t.Object({ tags: t.Array(t.String()) })
  })
  .post("/api/admin/media/batch-tag", async ({ user, set, body }) => {
    const capErr = await checkCap(user, set, "media:manage");
    if (capErr) return capErr;
    await batchTagMedia(body.mediaIds as string[], body.tagsToAdd as string[], body.tagsToRemove as string[]);
    return { success: true };
  }, {
    body: t.Object({
      mediaIds: t.Array(t.String()),
      tagsToAdd: t.Array(t.String()),
      tagsToRemove: t.Array(t.String()),
    })
  })
  .post("/api/admin/media/batch-delete", async ({ user, set, body }) => {
    const capErr = await checkCap(user, set, "media:manage");
    if (capErr) return capErr;
    const count = await batchSoftDeleteMedia(body.mediaIds as string[]);
    return { deleted: count };
  }, {
    body: t.Object({ mediaIds: t.Array(t.String()) })
  })
  .get("/api/admin/users", async ({ query, set, user }) => {
    const capErr = await checkCap(user, set, "user:read");
    if (capErr) return capErr;
    const q = typeof query.q === "string" ? query.q : undefined;
    const role = typeof query.role === "string" ? query.role : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    return await listUsers({ q, role, page, pageSize });
  })
  .patch("/api/admin/users/:id/role", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    const role = (body as any)?.role;
    if (!role || !["user", "dev", "ops"].includes(role)) {
      set.status = 400;
      return apiBadRequest(set, "Invalid role");
    }
    const updated = await setUserRole(id, role);
    if (!updated) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    await logAuditCompat({ action: "update_role", entity_type: "user", entity_id: id, diff: { role } });
    return updated;
  })
  .patch("/api/admin/users/:id/active", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    const isActive = (body as any)?.is_active;
    if (typeof isActive !== "boolean") {
      set.status = 400;
      return apiBadRequest(set, "is_active must be boolean");
    }
    const updated = await setUserActive(id, isActive);
    if (!updated) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    await logAuditCompat({ action: isActive ? "activate" : "deactivate", entity_type: "user", entity_id: id });
    return updated;
  })
  .post("/api/admin/users", async ({ body, set, user }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    const name = String((body as any)?.name ?? "").trim();
    const password = String((body as any)?.password ?? "").trim();
    const email = String((body as any)?.email ?? "").trim() || undefined;
    if (!name) {
      set.status = 400;
      return apiBadRequest(set, "Username is required");
    }
    const existing = await findUserByName(name);
    if (existing) {
      set.status = 409;
      return apiError(set, 409, "USERNAME_EXISTS", "Username already exists");
    }
    if (password && !validateSuperadminPassword(password)) {
      set.status = 400;
      return apiBadRequest(set, "Password does not meet requirements");
    }
    const created = await createUser({ name, email });
    if (password) {
      await setLocalAccountPassword(name, password, true);
    }
    await logAuditCompat({ action: "create_user", entity_type: "user", entity_id: created.id, diff: { name, email, has_password: !!password } }, user?.name);
    return created;
  })
  .delete("/api/admin/users/:id", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "user:delete");
    if (capErr) return capErr;
    const target = await findUserById(id);
    if (!target) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    if (isSuperadminUser(target.name)) {
      set.status = 403;
      return apiError(set, 403, "FORBIDDEN", "Cannot delete superadmin");
    }
    if (user?.id === id) {
      set.status = 403;
      return apiError(set, 403, "FORBIDDEN", "Cannot delete yourself");
    }
    const deleted = await deleteUser(id);
    if (!deleted) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    await logAuditCompat({ action: "delete_user", entity_type: "user", entity_id: id, diff: { name: target.name } }, user?.name);
    return { success: true };
  })
  .patch("/api/admin/users/:id/password", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    const password = String((body as any)?.password ?? "");
    if (!password || !validateSuperadminPassword(password)) {
      set.status = 400;
      return apiBadRequest(set, "Password does not meet requirements");
    }
    const target = await findUserById(id);
    if (!target) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    await setLocalAccountPassword(target.name, password, true);
    await bumpUserTokenVersion(id);
    await logAuditCompat({ action: "reset_password", entity_type: "user", entity_id: id }, user?.name);
    return { success: true };
  })
  .get("/api/admin/moderation/comments", async ({ query, set, user }) => {
    const capErr = await checkCap(user, set, "moderation:read");
    if (capErr) return capErr;
    const status = typeof query.status === "string" ? query.status : undefined;
    const actor_username = typeof query.actor_username === "string" ? query.actor_username : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    return await listCommentModeration({ status: status as any, actor_username, page, pageSize });
  })
  .get("/api/admin/moderation/bugs", async ({ query, set, user }) => {
    const capErr = await checkCap(user, set, "moderation:read");
    if (capErr) return capErr;
    const status = typeof query.status === "string" ? query.status : undefined;
    const actor_username = typeof query.actor_username === "string" ? query.actor_username : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    return await listBugModeration({ status: status as any, actor_username, page, pageSize });
  })
  .post("/api/admin/moderation/comments/:id/approve", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "moderation:approve");
    if (capErr) return capErr;
    const moderation = await getCommentModeration(id);
    if (!moderation) {
      set.status = 404;
      return apiNotFound(set);
    }
    if (moderation.status !== "pending") {
      set.status = 400;
      return apiBadRequest(set, "Already processed");
    }
    const feedback = await createFeedback({
      project_name: moderation.project_name,
      kind: "comment",
      title: "",
      body: moderation.body,
      labels: [],
      status: "open",
      actor_username: moderation.actor_username,
      actor_role: moderation.actor_role,
    } as any);
    await setCommentFeedbackEntryId(id, feedback.id);
    await updateCommentModerationStatus(id, "approved");
    await logAuditCompat({ action: "approve_comment", entity_type: "comment_moderation", entity_id: id }, user?.name);
    return { success: true, feedback_entry_id: feedback.id };
  })
  .post("/api/admin/moderation/comments/:id/reject", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "moderation:reject");
    if (capErr) return capErr;
    const moderation = await getCommentModeration(id);
    if (!moderation) {
      set.status = 404;
      return apiNotFound(set);
    }
    if (moderation.status !== "pending") {
      set.status = 400;
      return apiBadRequest(set, "Already processed");
    }
    const note = String((body as any)?.review_note ?? "");
    await updateCommentModerationStatus(id, "rejected", note);
    await logAuditCompat({ action: "reject_comment", entity_type: "comment_moderation", entity_id: id, diff: { review_note: note } }, user?.name);
    return { success: true };
  })
  .post("/api/admin/moderation/bugs/:id/approve", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "moderation:approve");
    if (capErr) return capErr;
    const moderation = await getBugModeration(id);
    if (!moderation) {
      set.status = 404;
      return apiNotFound(set);
    }
    if (moderation.status !== "pending") {
      set.status = 400;
      return apiBadRequest(set, "Already processed");
    }
    const feedback = await createFeedback({
      project_name: moderation.project_name,
      kind: "bug",
      title: moderation.title,
      body: moderation.body,
      labels: moderation.labels,
      status: "open",
      actor_username: moderation.actor_username,
      actor_role: moderation.actor_role,
    } as any);
    await setBugFeedbackEntryId(id, feedback.id);
    await updateBugModerationStatus(id, "approved");
    await logAuditCompat({ action: "approve_bug", entity_type: "bug_moderation", entity_id: id }, user?.name);
    return { success: true, feedback_entry_id: feedback.id };
  })
  .post("/api/admin/moderation/bugs/:id/reject", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "moderation:reject");
    if (capErr) return capErr;
    const moderation = await getBugModeration(id);
    if (!moderation) {
      set.status = 404;
      return apiNotFound(set);
    }
    if (moderation.status !== "pending") {
      set.status = 400;
      return apiBadRequest(set, "Already processed");
    }
    const note = String((body as any)?.review_note ?? "");
    await updateBugModerationStatus(id, "rejected", note);
    await logAuditCompat({ action: "reject_bug", entity_type: "bug_moderation", entity_id: id, diff: { review_note: note } }, user?.name);
    return { success: true };
  })
  .get("/api/moderation/my", async ({ query, set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const status = typeof query.status === "string" ? query.status : undefined;
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    const [comments, bugs] = await Promise.all([
      listCommentModeration({ status: status as any, actor_username: user.name, page, pageSize }),
      listBugModeration({ status: status as any, actor_username: user.name, page, pageSize }),
    ]);
    return { comments, bugs };
  })
  .get("/api/notifications", async ({ query, set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const unreadOnly = query.unreadOnly === "true";
    const page = typeof query.page === "string" ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : undefined;
    return await listNotifications({ user_name: user.name, unreadOnly, page, pageSize });
  })
  .patch("/api/notifications/:id/read", async ({ params: { id }, set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const updated = await markNotificationRead(id, user.name);
    if (!updated) {
      set.status = 404;
      return apiNotFound(set);
    }
    return updated;
  })
  .post("/api/notifications/read-all", async ({ set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    await markAllNotificationsRead(user.name);
    return { success: true };
  })
  .get("/api/capabilities", async ({ set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const allCaps = await listCapabilities();
    return { capabilities: allCaps };
  })
  .get("/api/user/capabilities", async ({ set, user }) => {
    const authErr = checkAuth(user, set);
    if (authErr) return authErr;
    const info = await getUserCapabilitiesWithInfo(user.id, user.name);
    return info;
  })
  .get("/api/admin/users/:id/capabilities", async ({ params: { id }, set, user }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    const { findUserById } = await import("./services/users");
    const target = await findUserById(id);
    if (!target) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    const info = await getUserCapabilitiesWithInfo(id, target.name);
    return info;
  })
  .put("/api/admin/users/:id/capabilities", async ({ params: { id }, body, set, user }) => {
    const capErr = await checkCap(user, set, "user:manage");
    if (capErr) return capErr;
    const { findUserById } = await import("./services/users");
    const target = await findUserById(id);
    if (!target) {
      set.status = 404;
      return apiNotFound(set, "User not found");
    }
    if (isSuperadminUser(target.name)) {
      set.status = 403;
      return apiError(set, 403, "FORBIDDEN", "Cannot modify superadmin capabilities");
    }
    const capabilityIds: string[] = (body as any)?.capabilities ?? [];
    await setUserCapabilities(id, capabilityIds);
    await logAuditCompat({ action: "update_capabilities", entity_type: "user", entity_id: id, diff: { capabilities: capabilityIds } }, user?.name);
    return { success: true };
  })
  .get("/api/admin/organizations", async ({ user, set, query }) => {
    const capErr = await checkCap(user, set, "org:review");
    if (capErr) return capErr;
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const status = query?.status as OrganizationStatus | undefined;
    return listOrganizations({ status, page, pageSize });
  })
  .get("/api/admin/organizations/:id", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "org:review");
    if (capErr) return capErr;
    const org = await findOrganizationById(id);
    if (!org) return apiNotFound(set, "Organization not found");
    const members = await getOrganizationMembers(id);
    return { ...org, members };
  })
  .post("/api/admin/organizations/:id/approve", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "org:review");
    if (capErr) return capErr;
    const payload = body as any;
    const org = await updateOrganizationStatus(id, "approved", payload?.review_note);
    if (!org) return apiNotFound(set, "Organization not found");
    await sql()`insert into notifications (user_name, type, title, body) select name, 'org_approved', '组织审核通过', ${'您的组织「' + org.name + '」已通过审核。'} from users where id = ${org.created_by}`;
    await logAuditCompat({ actor: user?.name, action: "approve", entity_type: "organization", entity_id: id });
    return org;
  })
  .post("/api/admin/organizations/:id/reject", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "org:review");
    if (capErr) return capErr;
    const payload = body as any;
    const org = await updateOrganizationStatus(id, "rejected", payload?.review_note);
    if (!org) return apiNotFound(set, "Organization not found");
    await sql()`insert into notifications (user_name, type, title, body) select name, 'org_rejected', '组织审核未通过', ${'您的组织「' + org.name + '」未通过审核。原因：' + (payload?.review_note ?? '无')} from users where id = ${org.created_by}`;
    await logAuditCompat({ actor: user?.name, action: "reject", entity_type: "organization", entity_id: id });
    return org;
  })
  .patch("/api/admin/organizations/:id", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "org:manage");
    if (capErr) return capErr;
    const payload = body as any;
    if (payload?.status) {
      const org = await updateOrganizationStatus(id, payload.status, payload.review_note);
      if (!org) return apiNotFound(set, "Organization not found");
      return org;
    }
    const updated = await updateOrganization(id, { name: payload?.name, description: payload?.description, website_url: payload?.website_url });
    if (!updated) return apiNotFound(set, "Organization not found");
    return updated;
  })
  .delete("/api/admin/organizations/:id", async ({ params: { id }, user, set }) => {
    const capErr = await checkCap(user, set, "org:manage");
    if (capErr) return capErr;
    const deleted = await deleteOrganization(id);
    if (!deleted) return apiNotFound(set, "Organization not found");
    await logAuditCompat({ actor: user?.name, action: "delete", entity_type: "organization", entity_id: id });
    return { ok: true };
  })
  .get("/api/admin/project-claims", async ({ user, set, query }) => {
    const capErr = await checkCap(user, set, "claim:review");
    if (capErr) return capErr;
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const status = query?.status as ClaimStatus | undefined;
    return listProjectClaims({ status, page, pageSize });
  })
  .post("/api/admin/project-claims/:id/approve", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "claim:review");
    if (capErr) return capErr;
    const payload = body as any;
    const claim = await approveProjectClaim(id, payload?.review_note);
    if (!claim) return apiNotFound(set, "Claim not found or already processed");
    await sql()`insert into notifications (user_name, type, title, body) select name, 'claim_approved', '项目认领已通过', '您申请认领的项目已通过审核。' from users where id = ${claim.user_id}`;
    await logAuditCompat({ actor: user?.name, action: "approve_claim", entity_type: "project_claim", entity_id: id });
    return claim;
  })
  .post("/api/admin/project-claims/:id/reject", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "claim:review");
    if (capErr) return capErr;
    const payload = body as any;
    const claim = await rejectProjectClaim(id, payload?.review_note);
    if (!claim) return apiNotFound(set, "Claim not found or already processed");
    await sql()`insert into notifications (user_name, type, title, body) select name, 'claim_rejected', '项目认领未通过', ${'您申请认领的项目未通过审核。原因：' + (payload?.review_note ?? '无')} from users where id = ${claim.user_id}`;
    await logAuditCompat({ actor: user?.name, action: "reject_claim", entity_type: "project_claim", entity_id: id });
    return claim;
  })
  .post("/api/admin/projects/:id/members", async ({ params: { id }, body, user, set }) => {
    const capErr = await checkCap(user, set, "project:update");
    if (capErr) return capErr;
    const payload = body as any;
    if (!payload?.user_id && !payload?.org_id) return apiBadRequest(set, "user_id or org_id is required");
    const result = await addProjectMember({ project_id: id, user_id: payload.user_id, org_id: payload.org_id, role: payload.role ?? "owner" });
    if (payload.user_id) await promoteToDev(payload.user_id);
    await logAuditCompat({ actor: user?.name, action: "add_project_member", entity_type: "project", entity_id: id, diff: { user_id: payload.user_id, org_id: payload.org_id, role: payload.role } });
    return result;
  })
  .delete("/api/admin/projects/:id/members/:memberId", async ({ params: { id, memberId }, body, user, set }) => {
    const capErr = await checkCap(user, set, "project:update");
    if (capErr) return capErr;
    const payload = body as any;
    let removed = false;
    if (payload?.org_id) {
      removed = await removeProjectOrgMember(id, payload.org_id);
    } else if (memberId) {
      removed = await removeProjectMember(id, memberId);
      if (removed) await demoteFromDev(memberId);
    }
    if (!removed) return apiBadRequest(set, "Cannot remove member");
    await logAuditCompat({ actor: user?.name, action: "remove_project_member", entity_type: "project", entity_id: id });
    return { ok: true };
  })
  .listen(Number(process.env.PORT ?? 8081));

/**
 * Normalize a CSV row into the internal project payload shape.
 *
 * The CSV import supports bilingual / alias column headers and maps them into canonical keys.
 * The return value is a partial project input that is further sanitized by {@link normalizeProjectInput}.
 */
function buildProjectMediaFields(project: any): Array<{ url: string; fieldPath: string }> {
  const fields: Array<{ url: string; fieldPath: string }> = [];
  if (project.icon) fields.push({ url: project.icon, fieldPath: "icon" });
  if (project.banner) fields.push({ url: project.banner, fieldPath: "banner" });
  if (project.avatar) fields.push({ url: project.avatar, fieldPath: "avatar" });
  return fields;
}

function normalizeCsvRow(row: Record<string, string>) {  const aliases: Record<string, string> = {
    name: "name",
    github: "github_url",
    repo: "github_url",
    desc: "description",
    slug: "slug",
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
  `馃 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
