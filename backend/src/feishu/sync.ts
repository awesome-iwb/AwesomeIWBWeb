import { randomUUID } from "crypto";

export type SyncAuditStatus = "通过" | "待审核" | "未通过";

export type SyncInputProject = {
  name: string;
  category: string;
  audit_status: SyncAuditStatus;
  organization: string;
  developer?: string;
  github_url?: string;
  description?: string;
  website?: string;
  github_account?: string;
  tech_stack?: string[];
  project_state_tags?: string[];
  ai_usage_state?: "unknown" | "over50" | "under50";
  language?: string;
};

export type FileModeSubmission = {
  id: string;
  status: "pending" | "approved" | "rejected";
  payload: any;
  review_note: string;
  created_at: string;
  updated_at: string;
};

const normalizeKey = (v: string) => v.trim().toLowerCase();

const ensureCategoryId = (data: any, name: string) => {
  const key = normalizeKey(name);
  const existing = (data.categories ?? []).find((c: any) => normalizeKey(String(c?.name ?? "")) === key);
  if (existing) return String(existing.id ?? "");
  const id = randomUUID().replaceAll("-", "").slice(0, 8);
  (data.categories ??= []).push({ id, name, description: "", projects: [] });
  return id;
};

const findProjectSlot = (data: any, name: string) => {
  const key = normalizeKey(name);
  for (const c of data.categories ?? []) {
    const idx = (c.projects ?? []).findIndex((p: any) => normalizeKey(String(p?.name ?? "")) === key);
    if (idx !== -1) return { category: c, index: idx, project: c.projects[idx] };
  }
  return null;
};

const recommendationFromTags = (tags: string[]) => {
  if (tags.includes("值得推荐")) return "🥇 强烈推荐";
  if (tags.includes("稳定")) return "🥈 值得尝试";
  if (tags.includes("不稳定")) return "🥉 谨慎选择";
  if (tags.includes("画饼")) return "🧪 观望中";
  if (tags.includes("薛定谔的猫")) return "🤷‍♂️ 看情况";
  return "";
};

export function syncFeishuSnapshotToFileMode(input: {
  existingData: any;
  snapshotProjects: SyncInputProject[];
  submissions: FileModeSubmission[];
}) {
  const data = structuredClone(input.existingData ?? { categories: [] });
  const submissions = structuredClone(input.submissions ?? []) as FileModeSubmission[];

  const stats = {
    created: 0,
    updated: 0,
    inactivated: 0,
    removed_from_catalog: 0,
    submissions_created: 0,
    submissions_updated: 0
  };

  const allSnapshotKeys = new Set(input.snapshotProjects.map((p) => normalizeKey(p.name)));
  const approvedKeys = new Set(input.snapshotProjects.filter((p) => p.audit_status === "通过").map((p) => normalizeKey(p.name)));
  const nonApproved = input.snapshotProjects.filter((p) => p.audit_status !== "通过");
  const nonApprovedKeys = new Set(nonApproved.map((p) => normalizeKey(p.name)));

  const isStaleByLastUpdate = (proj: any) => {
    const raw = proj?.last_update;
    if (typeof raw !== "string" || !raw.trim()) return false;
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) return false;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    return Date.now() - t >= oneYearMs;
  };

  for (const p of input.snapshotProjects) {
    if (p.category) ensureCategoryId(data, p.category.trim());
  }

  for (const c of data.categories ?? []) {
    const projects = Array.isArray(c.projects) ? c.projects : [];
    const next: any[] = [];
    for (const proj of projects) {
      const key = normalizeKey(String(proj?.name ?? ""));
      if (nonApprovedKeys.has(key)) {
        stats.removed_from_catalog++;
        continue;
      }
      if (!allSnapshotKeys.has(key) && isStaleByLastUpdate(proj)) {
        if (String(proj?.status ?? "") !== "不活跃") {
          proj.status = "不活跃";
          stats.inactivated++;
        }
      }
      next.push(proj);
    }
    c.projects = next;
  }

  const now = new Date().toISOString();

  const upsertSubmission = (project: SyncInputProject, status: "pending" | "rejected" | "approved", createIfMissing: boolean) => {
    const key = normalizeKey(project.name);
    const existing = submissions.find((s) => normalizeKey(String(s.payload?.name ?? "")) === key);
    const payload = {
      name: project.name,
      developer: project.developer ?? "",
      github_url: project.github_url ?? "",
      description: project.description ?? "",
      category: project.category ?? "",
      organization: project.organization ?? ""
    };
    if (existing) {
      existing.status = status;
      existing.payload = payload;
      existing.updated_at = now;
      stats.submissions_updated++;
      return existing;
    }
    if (!createIfMissing) return null;
    const created: FileModeSubmission = {
      id: randomUUID(),
      status,
      payload,
      review_note: "",
      created_at: now,
      updated_at: now
    };
    submissions.unshift(created);
    stats.submissions_created++;
    return created;
  };

  for (const p of nonApproved) {
    if (p.audit_status === "待审核") upsertSubmission(p, "pending", true);
    if (p.audit_status === "未通过") upsertSubmission(p, "rejected", true);
  }

  for (const p of input.snapshotProjects.filter((x) => x.audit_status === "通过")) {
    const catName = p.category?.trim() || "未分类";
    const categoryId = ensureCategoryId(data, catName);
    const slot = findProjectSlot(data, p.name);
    const stateTags = Array.isArray(p.project_state_tags) ? p.project_state_tags : [];
    const tech = Array.isArray(p.tech_stack) ? p.tech_stack : [];
    const keywords = Array.from(new Set(stateTags)).filter(Boolean);

    const nextPatch: any = {
      name: p.name,
      developer: p.developer ?? "",
      status: "活跃",
      recommendation: recommendationFromTags(stateTags),
      ai_usage_state: p.ai_usage_state ?? "unknown",
      github_url: p.github_url ?? "",
      description: p.description ?? "",
      keywords,
      language: p.language ?? "",
      organization: p.organization ?? "",
      extra: {
        ...(slot?.project?.extra ?? {}),
        feishu: {
          ...(slot?.project?.extra?.feishu ?? {}),
          organization: p.organization ?? "",
          category: p.category ?? "",
          tech_stack: tech,
          project_state_tags: stateTags,
          website: p.website ?? "",
          github_account: p.github_account ?? ""
        }
      }
    };

    if (slot) {
      const before = slot.project;
      const merged = {
        ...before,
        ...nextPatch,
        avatar: before.avatar ?? "",
        icon: before.icon ?? before.avatar ?? "",
        banner: before.banner ?? ""
      };
      slot.category.projects.splice(slot.index, 1);
      const targetCat = (data.categories ?? []).find((c: any) => String(c.id ?? "") === String(categoryId)) ?? slot.category;
      (targetCat.projects ??= []).unshift(merged);
      stats.updated++;
    } else {
      const targetCat = (data.categories ?? []).find((c: any) => normalizeKey(String(c?.id ?? "")) === normalizeKey(String(categoryId))) ?? (data.categories ?? [])[0];
      (targetCat.projects ??= []).unshift({
        ...nextPatch,
        avatar: "",
        icon: "",
        banner: ""
      });
      stats.created++;
    }

    upsertSubmission(p, "approved", false);
  }

  return { data, submissions, stats };
}
