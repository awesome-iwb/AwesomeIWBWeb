const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type MutationOriginGuardInput = {
  method: string;
  headers: Record<string, string | undefined>;
  requestUrl?: string;
  allowedOrigins: readonly string[];
  sessionCookieName: string;
  isProduction: boolean;
};

export type MutationOriginGuardResult =
  | { allowed: true }
  | { allowed: false; reason: "origin_not_allowed" | "referer_not_allowed" | "missing_origin" };

function getHeader(headers: Record<string, string | undefined>, name: string) {
  const lower = name.toLowerCase();
  return headers[lower] ?? headers[name] ?? headers[name.toUpperCase()];
}

function hasBearerAuthorization(headers: Record<string, string | undefined>) {
  const auth = getHeader(headers, "authorization") ?? "";
  return /^Bearer\s+\S+/i.test(auth);
}

function hasCookie(cookieHeader: string | undefined, cookieName: string) {
  const target = cookieName.trim();
  if (!cookieHeader || !target) return false;
  return cookieHeader.split(";").some((part) => {
    const idx = part.indexOf("=");
    if (idx <= 0) return false;
    return part.slice(0, idx).trim() === target;
  });
}

function normalizeOrigin(raw: string | undefined) {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function allowedOriginSet(allowedOrigins: readonly string[], requestUrl?: string) {
  const origins = new Set<string>();
  for (const origin of allowedOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) origins.add(normalized);
  }
  const requestOrigin = normalizeOrigin(requestUrl);
  if (requestOrigin) origins.add(requestOrigin);
  return origins;
}

function isAllowedOrigin(raw: string | undefined, allowedOrigins: Set<string>) {
  const origin = normalizeOrigin(raw);
  return Boolean(origin && allowedOrigins.has(origin));
}

function originFromReferer(raw: string | undefined) {
  return normalizeOrigin(raw);
}

export function evaluateMutationOriginGuard(input: MutationOriginGuardInput): MutationOriginGuardResult {
  if (!UNSAFE_METHODS.has(input.method.toUpperCase())) return { allowed: true };

  const cookieHeader = getHeader(input.headers, "cookie");
  if (!hasCookie(cookieHeader, input.sessionCookieName)) return { allowed: true };

  if (hasBearerAuthorization(input.headers)) return { allowed: true };

  const allowedOrigins = allowedOriginSet(input.allowedOrigins, input.requestUrl);
  const origin = getHeader(input.headers, "origin");
  if (origin) {
    return isAllowedOrigin(origin, allowedOrigins)
      ? { allowed: true }
      : { allowed: false, reason: "origin_not_allowed" };
  }

  const refererOrigin = originFromReferer(getHeader(input.headers, "referer"));
  if (refererOrigin) {
    return allowedOrigins.has(refererOrigin)
      ? { allowed: true }
      : { allowed: false, reason: "referer_not_allowed" };
  }

  if (input.isProduction) return { allowed: false, reason: "missing_origin" };
  return { allowed: true };
}
