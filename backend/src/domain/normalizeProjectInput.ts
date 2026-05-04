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
          sectl_user_id: typeof x?.sectl_user_id === "string" ? x.sectl_user_id : "",
          lincube_user_id: typeof x?.lincube_user_id === "string" ? x.lincube_user_id : ""
        };
      })
      .filter((x) => x.username.trim() || x.stcn_user_id.trim() || x.sectl_user_id.trim() || x.lincube_user_id.trim());
  };

  const readDevelopersField = (obj: any) => {
    if (!Object.prototype.hasOwnProperty.call(obj ?? {}, "platform_developers")) return undefined;
    return normalizeDevelopers(obj.platform_developers);
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
    platform_developers: readDevelopersField(p),
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

