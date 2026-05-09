import crypto from "crypto";

type NodeEnv = "development" | "test" | "production";

function asNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === "production" || raw === "test") return raw;
  return "development";
}

function requiredInProduction(name: string, value?: string) {
  if (process.env.NODE_ENV === "production" && (!value || !value.trim())) {
    throw new Error(`${name} is required in production`);
  }
}

function parseList(raw?: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const nodeEnv = asNodeEnv(process.env.NODE_ENV);
const allowedOrigins = parseList(process.env.ALLOWED_ORIGINS);
const dbEnabled = Boolean(process.env.DATABASE_URL);
const oauthEnabled = process.env.OAUTH_ENABLED !== "false";
const superadminOnlyLocal = process.env.SUPERADMIN_ONLY_LOCAL !== "false";

requiredInProduction("JWT_SECRET", process.env.JWT_SECRET);
requiredInProduction("DATABASE_URL", process.env.DATABASE_URL);
requiredInProduction("ALLOWED_ORIGINS", process.env.ALLOWED_ORIGINS);
requiredInProduction("COOKIE_DOMAIN", process.env.COOKIE_DOMAIN);
requiredInProduction("SESSION_COOKIE_NAME", process.env.SESSION_COOKIE_NAME);
if (nodeEnv === "production" && oauthEnabled) {
  requiredInProduction("CASDOOR_ENDPOINT", process.env.CASDOOR_ENDPOINT);
  requiredInProduction("CASDOOR_CLIENT_ID", process.env.CASDOOR_CLIENT_ID);
  requiredInProduction("CASDOOR_CLIENT_SECRET", process.env.CASDOOR_CLIENT_SECRET);
  requiredInProduction("CASDOOR_REDIRECT_URI", process.env.CASDOOR_REDIRECT_URI);
}

if (nodeEnv === "production" && !dbEnabled) {
  throw new Error("DATABASE_URL is required in production; JSON mode is disabled");
}

const jwtSecret =
  process.env.JWT_SECRET?.trim() ||
  (nodeEnv === "production" ? "" : crypto.randomBytes(32).toString("hex"));

if (!jwtSecret) {
  throw new Error("JWT_SECRET is missing");
}

if (!process.env.JWT_SECRET && nodeEnv !== "production") {
  console.warn("[security] JWT_SECRET not set in non-production, using ephemeral secret");
}

/** Session cookies: Secure only when the public site URL is HTTPS (or inferred safe). Never force Secure on plain HTTP deployments. */
function resolveCookieSecure(): boolean {
  if (process.env.FORCE_INSECURE_COOKIES === "true") return false;

  const raw =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.VITE_PUBLIC_BASE_URL?.trim() ||
    "";

  try {
    if (raw) {
      const u = new URL(raw);
      return u.protocol === "https:";
    }
  } catch {
    /* fall through */
  }

  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  // Without an explicit https:// base URL, do not set Secure (plain HTTP / IP deployments).
  return false;
}

export const appConfig = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  dbEnabled,
  jwtSecret,
  jwtIssuer: process.env.JWT_ISSUER?.trim() || "awesome-iwb-backend",
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || "awesome-iwb-web",
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 7 * 24 * 3600),
  allowedOrigins,
  cookieDomain: process.env.COOKIE_DOMAIN?.trim() || "",
  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || "session",
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 30),
  oauthEnabled,
  superadminOnlyLocal,
  casdoor: {
    endpoint: process.env.CASDOOR_ENDPOINT?.trim() || "",
    clientId: process.env.CASDOOR_CLIENT_ID?.trim() || "",
    clientSecret: process.env.CASDOOR_CLIENT_SECRET?.trim() || "",
    organization: process.env.CASDOOR_ORGANIZATION_NAME?.trim() || "stcn",
    application: process.env.CASDOOR_APPLICATION_NAME?.trim() || "awesome-iwb",
    redirectUri: process.env.CASDOOR_REDIRECT_URI?.trim() || "http://localhost:8080/api/auth/callback",
    allowedRedirectOrigins: parseList(process.env.AUTH_REDIRECT_ALLOWLIST || process.env.ALLOWED_ORIGINS)
  },
  cookieSecure: resolveCookieSecure()
} as const;
