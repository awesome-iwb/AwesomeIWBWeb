import { readAiUsageStateField } from "./aiUsage";
import { normalizeGithubRepoUrl, normalizeInternalUploadUrl } from "./urlSafety";

export function normalizeProjectInput(p: any) {
  const input = p && typeof p === "object" ? p : {};

  const normalizeGithubUrl = (value: any) => {
    if (typeof value !== "string") return undefined;
    return normalizeGithubRepoUrl(value);
  };

  const normalizeMediaUrl = (value: any) => {
    if (typeof value !== "string") return undefined;
    return normalizeInternalUploadUrl(value);
  };

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
    return s.split(/[;,\uFF1B,\uFF0C\u3001]/).map((x) => x.trim()).filter(Boolean);
  };

  const normalizeDevelopers = (v: any) => {
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => {
        const legacy = typeof x?.user_id === "string" ? x.user_id : "";
        const stcn = typeof x?.stcn_user_id === "string" ? x.stcn_user_id : legacy;
        return {
          username: typeof x?.username === "string" ? x.username : "",
          stcn_user_id: stcn,
          hzzc_user_id: typeof x?.hzzc_user_id === "string" ? x.hzzc_user_id : "",
        };
      })
      .filter((x) => x.username.trim() || x.stcn_user_id.trim() || x.hzzc_user_id.trim());
  };

  const readDevelopersField = (obj: any) => {
    if (!Object.prototype.hasOwnProperty.call(obj ?? {}, "platform_developers")) return undefined;
    return normalizeDevelopers(obj.platform_developers);
  };

  const readMediaField = (obj: any, canonicalKey: string, legacyKey: string) => {
    if (typeof obj?.[canonicalKey] === "string") return normalizeMediaUrl(obj[canonicalKey]);
    if (typeof obj?.[legacyKey] === "string") return normalizeMediaUrl(obj[legacyKey]);
    return undefined;
  };

  return {
    slug: typeof input.slug === "string" ? input.slug.trim() : undefined,
    name: typeof input.name === "string" ? input.name.trim() : undefined,
    category_id: Object.prototype.hasOwnProperty.call(input, "category_id")
      ? (typeof input.category_id === "string" ? input.category_id : null)
      : undefined,
    developer: typeof input.developer === "string" ? input.developer : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    version: typeof input.version === "string" ? input.version : undefined,
    ai_usage_state: readAiUsageStateField(input),
    description: typeof input.description === "string" ? input.description : undefined,
    keywords: Object.prototype.hasOwnProperty.call(input, "keywords") ? normalizeList(input.keywords) : undefined,
    recommendation: Object.prototype.hasOwnProperty.call(input, "recommendation")
      ? normalizeList(input.recommendation)
      : undefined,
    github_url: normalizeGithubUrl(input.github_url),
    platform_developers: readDevelopersField(input),
    avatar: readMediaField(input, "avatar", "avatar_url"),
    icon: readMediaField(input, "icon", "icon_url"),
    banner: readMediaField(input, "banner", "banner_url"),
    stars: Object.prototype.hasOwnProperty.call(input, "stars")
      ? (typeof input.stars === "number" && !Number.isNaN(input.stars) ? input.stars : 0)
      : undefined,
    language: typeof input.language === "string" ? input.language : undefined,
    last_update: typeof input.last_update === "string" ? input.last_update : undefined,
    github_is_fork: Object.prototype.hasOwnProperty.call(input, "github_is_fork")
      ? (typeof input.github_is_fork === "boolean" ? input.github_is_fork : false)
      : undefined,
    github_parent_url: normalizeGithubUrl(input.github_parent_url),
    github_source_url: normalizeGithubUrl(input.github_source_url),
    extra: Object.prototype.hasOwnProperty.call(input, "extra")
      ? (typeof input.extra === "object" && input.extra ? input.extra : {})
      : undefined,
    organization_id: Object.prototype.hasOwnProperty.call(input, "organization_id")
      ? (typeof input.organization_id === "string" ? input.organization_id : null)
      : undefined,
    developer_user_id: Object.prototype.hasOwnProperty.call(input, "developer_user_id")
      ? (typeof input.developer_user_id === "string" ? input.developer_user_id : null)
      : undefined,
  };
}
