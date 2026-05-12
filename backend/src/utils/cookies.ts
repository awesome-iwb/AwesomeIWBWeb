import { appConfig } from "../config";

const JWT_MAX_AGE = appConfig.jwtExpiresInSeconds;

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function buildSessionCookie(token: string) {
  const segments = [
    `${appConfig.sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${JWT_MAX_AGE}`
  ];
  if (appConfig.cookieSecure) segments.push("Secure");
  if (appConfig.cookieDomain) segments.push(`Domain=${appConfig.cookieDomain}`);
  return segments.join("; ");
}

export function buildClearSessionCookie() {
  const segments = [
    `${appConfig.sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (appConfig.cookieSecure) segments.push("Secure");
  if (appConfig.cookieDomain) segments.push(`Domain=${appConfig.cookieDomain}`);
  return segments.join("; ");
}

export function appendSetCookie(set: any, cookie: string) {
  const existing = set.headers["set-cookie"];
  if (!existing) {
    set.headers["set-cookie"] = cookie;
    return;
  }
  if (Array.isArray(existing)) {
    set.headers["set-cookie"] = [...existing, cookie];
    return;
  }
  set.headers["set-cookie"] = [existing, cookie];
}

export function setSessionCookie(set: any, token: string) {
  appendSetCookie(set, buildSessionCookie(token));
}

export function clearSessionCookie(set: any) {
  appendSetCookie(set, buildClearSessionCookie());
}
