import { readAiUsageStateField } from "./aiUsage";

export function normalizeProjectInput(p: any) {
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

  const normalizeDevelopers = (v: any) => {
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => {
        const legacy = typeof x?.user_id === "string" ? x.user_id : "";
        const stcn = typeof x?.stcn_user_id === "string" ? x.stcn_user_id : legacy;
        return {
          username: typeof x?.username === "string" ? x.username : "",
          stcn_user_id: stcn,
          hzzc_user_id: typeof x?.hzzc_user_id === "string" ? x.hzzc_user_id : ""
        };
      })
      .filter((x) => x.username.trim() || x.stcn_user_id.trim() || x.hzzc_user_id.trim());
  };

  const readDevelopersField = (obj: any) => {
    if (!Object.prototype.hasOwnProperty.call(obj ?? {}, "platform_developers")) return undefined;
    return normalizeDevelopers(obj.platform_developers);
  };

  return {
    slug: typeof p.slug === "string" ? p.slug.trim() : undefined,
    name: typeof p.name === "string" ? p.name.trim() : undefined,
    category_id: Object.prototype.hasOwnProperty.call(p, "category_id") ? (typeof p.category_id === "string" ? p.category_id : null) : undefined,
    developer: typeof p.developer === "string" ? p.developer : undefined,
    status: typeof p.status === "string" ? p.status : undefined,
    version: typeof p.version === "string" ? p.version : undefined,
    ai_usage_state: readAiUsageStateField(p),
    description: typeof p.description === "string" ? p.description : undefined,
    keywords: Object.prototype.hasOwnProperty.call(p, "keywords") ? normalizeList(p.keywords) : undefined,
    recommendation: Object.prototype.hasOwnProperty.call(p, "recommendation") ? (typeof p.recommendation === 'string' ? p.recommendation.trim() : normalizeList(p.recommendation)) : undefined,
    github_url: typeof p.github_url === "string" ? p.github_url : undefined,
    platform_developers: readDevelopersField(p),
    avatar: typeof p.avatar === "string" ? p.avatar : undefined,
    icon: typeof p.icon === "string" ? p.icon : undefined,
    banner: typeof p.banner === "string" ? p.banner : undefined,
    stars: Object.prototype.hasOwnProperty.call(p, "stars") ? (typeof p.stars === "number" && !Number.isNaN(p.stars) ? p.stars : 0) : undefined,
    language: typeof p.language === "string" ? p.language : undefined,
    last_update: typeof p.last_update === "string" ? p.last_update : undefined,
    github_is_fork: Object.prototype.hasOwnProperty.call(p, "github_is_fork") ? (typeof p.github_is_fork === "boolean" ? p.github_is_fork : false) : undefined,
    github_parent_url: typeof p.github_parent_url === "string" ? p.github_parent_url : undefined,
    github_source_url: typeof p.github_source_url === "string" ? p.github_source_url : undefined,
    extra: Object.prototype.hasOwnProperty.call(p, "extra") ? (typeof p.extra === "object" && p.extra ? p.extra : {}) : undefined
  };
}

