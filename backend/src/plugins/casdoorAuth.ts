import { Elysia } from "elysia";
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { signJwt } from "../utils/jwt";
import { bumpUserTokenVersion, createUser, findUserByCasdoorId, findUserById, findUserByName, updateUserLogin } from "../services/users";
import { getUserCapabilitiesWithInfo } from "../services/capabilities";
import { appConfig } from "../config";
import { appendSetCookie, clearSessionCookie, parseCookieHeader, setSessionCookie } from "../utils/cookies";
import { checkRateLimit } from "./rateLimit";

const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT ?? "https://auth.smart-teach.cn";
const CASDOOR_CLIENT_ID = process.env.CASDOOR_CLIENT_ID ?? "";
const CASDOOR_CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET ?? "";
const CASDOOR_ORGANIZATION = process.env.CASDOOR_ORGANIZATION_NAME ?? "stcn";
const CASDOOR_APPLICATION = process.env.CASDOOR_APPLICATION_NAME ?? "AIWB";
const CASDOOR_REDIRECT_URI = process.env.CASDOOR_REDIRECT_URI ?? "http://localhost:5173/api/auth/callback";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const JWT_SUB_LOCAL_PREFIX = "local:";
const JWT_SUB_TOKEN_PREFIX = "token:";
const PG_ENABLED = Boolean(process.env.DATABASE_URL);

function authError(set: any, status: number, code: string, message: string) {
  const traceId = randomUUID();
  set.status = status;
  set.headers["cache-control"] = "private, no-store";
  set.headers["vary"] = "Cookie, Authorization";
  return { error: { code, message, traceId } };
}

function logAuthEvent(event: string, extra: Record<string, unknown> = {}) {
  try {
    console.info(`[auth.casdoor] ${event}`, {
      ...extra,
      cookieDomain: appConfig.cookieDomain || '',
      cookieSecure: appConfig.cookieSecure,
    });
  } catch {}
}

/** Postgres `local_accounts.id` is a UUID; JSON/dev mode may use non-UUID ids. */
const LOCAL_SUBJECT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAllowedLocalSubjectId(raw: string): boolean {
  if (!raw) return false;
  if (LOCAL_SUBJECT_UUID_RE.test(raw)) return true;
  return !PG_ENABLED && /^[\w.-]+$/.test(raw) && raw.length <= 160;
}

const OAUTH_STATE_COOKIE = "awesomeiwb_oauth_state";
const CALLBACK_MODE_JSON_HEADER = "x-auth-response";

function wantsJsonCallbackResponse(query: any, headers: Record<string, string | undefined>): boolean {
  const mode = String(query?.mode ?? "").trim().toLowerCase();
  if (mode === "json") return true;
  const header = String(headers[CALLBACK_MODE_JSON_HEADER] ?? "").trim().toLowerCase();
  return header === "json";
}

function shouldPreferHtmlRedirect(headers: Record<string, string | undefined>): boolean {
  const accept = String(headers["accept"] ?? "").toLowerCase();
  return accept.includes("text/html");
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signState(value: string): string {
  return createHmac("sha256", appConfig.jwtSecret).update(value).digest("hex");
}

function encodeStateCookie(payload: { state: string; codeVerifier: string; returnTo: string; createdAt: number; popup: boolean }) {
  const raw = JSON.stringify(payload);
  const b64 = base64Url(raw);
  return `${b64}.${signState(b64)}`;
}

function decodeStateCookie(cookieValue?: string) {
  if (!cookieValue) return null;
  const [b64, sig] = cookieValue.split(".");
  if (!b64 || !sig) return null;
  if (signState(b64) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as { state: string; codeVerifier: string; returnTo: string; createdAt: number; popup?: boolean };
    if (Date.now() - payload.createdAt > 10 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function setOauthStateCookie(set: any, payload: { state: string; codeVerifier: string; returnTo: string; createdAt: number; popup: boolean }) {
  const value = encodeStateCookie(payload);
  const parts = [`${OAUTH_STATE_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=600"];
  if (appConfig.cookieSecure) parts.push("Secure");
  if (appConfig.cookieDomain) parts.push(`Domain=${appConfig.cookieDomain}`);
  appendSetCookie(set, parts.join("; "));
}

function readCookieDebugInfo(headers: Record<string, string | undefined>) {
  return {
    hasCookieHeader: Boolean(headers["cookie"]),
    host: headers["host"] ?? "",
    forwardedProto: headers["x-forwarded-proto"] ?? "",
    origin: headers["origin"] ?? "",
    referer: headers["referer"] ?? "",
  };
}

function clearOauthStateCookie(set: any) {
  const parts = [`${OAUTH_STATE_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (appConfig.cookieSecure) parts.push("Secure");
  if (appConfig.cookieDomain) parts.push(`Domain=${appConfig.cookieDomain}`);
  appendSetCookie(set, parts.join("; "));
}

function pickSafeReturnTo(input: string): string {
  if (!input) return "/";
  if (input.startsWith("/")) return input;
  try {
    const u = new URL(input);
    const allowed = appConfig.allowedOrigins.includes(u.origin) || appConfig.casdoor.allowedRedirectOrigins.includes(u.origin);
    if (!allowed) return "/";
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "/";
  }
}

function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const url = new URL(`${CASDOOR_ENDPOINT}/login/oauth/authorize`);
  url.searchParams.set("client_id", CASDOOR_CLIENT_ID);
  url.searchParams.set("redirect_uri", CASDOOR_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("organization", CASDOOR_ORGANIZATION);
  url.searchParams.set("application", CASDOOR_APPLICATION);
  return url.toString();
}

async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<{ access_token: string } | null> {
  const res = await fetch(`${CASDOOR_ENDPOINT}/api/login/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CASDOOR_CLIENT_ID,
      client_secret: CASDOOR_CLIENT_SECRET,
      code,
      redirect_uri: CASDOOR_REDIRECT_URI,
      code_verifier: codeVerifier
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.access_token ? data : null;
}

async function fetchCasdoorUser(accessToken: string): Promise<any | null> {
  const res = await fetch(`${CASDOOR_ENDPOINT}/api/get-account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok) return await res.json();
  const oidcRes = await fetch(`${CASDOOR_ENDPOINT}/api/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (oidcRes.ok) return await oidcRes.json();
  return null;
}

// Demo mode: when Casdoor is not configured, simulate a login redirect
// that creates a demo user. Set DEMO_LOGIN=true to enable.
const DEMO_LOGIN = process.env.DEMO_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const casdoorAuthPlugin = new Elysia({ prefix: "/api/auth" })
  .get("/login", ({ set, query, headers }) => {
    if (checkRateLimit({ headers, path: "/api/auth/casdoor/login", set })) return authError(set, 429, "RATE_LIMITED", "Too Many Requests");
    if (!appConfig.oauthEnabled) {
      return authError(set, 503, "OAUTH_DISABLED", "OAuth disabled by OAUTH_ENABLED=false");
    }
    if (!CASDOOR_ENDPOINT || !CASDOOR_CLIENT_ID) {
      if (DEMO_LOGIN) {
        // Simulate Casdoor login by redirecting directly to callback with a demo code
        const state = randomUUID();
        const demoCallbackUrl = new URL(`${FRONTEND_URL}/me`);
        demoCallbackUrl.searchParams.set("code", "demo-auth-code");
        demoCallbackUrl.searchParams.set("state", state);
        return { authorizeUrl: demoCallbackUrl.toString() };
      }
      return authError(set, 503, "CASDOOR_NOT_CONFIGURED", "Casdoor not configured");
    }
    const state = randomUUID();
    const codeVerifier = base64Url(randomBytes(32));
    const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());
    const returnToRaw = typeof (query as any)?.returnTo === "string" ? String((query as any).returnTo) : "/";
    const returnTo = pickSafeReturnTo(returnToRaw);
    const popupMode = String((query as any)?.popup ?? "").trim().toLowerCase() === "1";
    setOauthStateCookie(set, { state, codeVerifier, returnTo, createdAt: Date.now(), popup: popupMode });
    logAuthEvent("oauth_state_issued", {
      popupMode,
      returnTo,
      ...readCookieDebugInfo(headers),
    });
    return { authorizeUrl: buildAuthorizeUrl(state, codeChallenge) };
  })
  .get("/callback", async ({ query, set, headers }) => {
    if (checkRateLimit({ headers, path: "/api/auth/casdoor/callback", set })) return authError(set, 429, "RATE_LIMITED", "Too Many Requests");
    if (!appConfig.oauthEnabled) {
      return authError(set, 503, "OAUTH_DISABLED", "OAuth disabled by OAUTH_ENABLED=false");
    }
    const code = String((query as any)?.code ?? "");
    const state = String((query as any)?.state ?? "");

    if (!code || !state) {
      return authError(set, 400, "BAD_REQUEST", "Missing code or state");
    }
    const oauthStateValue = parseCookieHeader(headers["cookie"])[OAUTH_STATE_COOKIE];
    const oauthCookie = decodeStateCookie(oauthStateValue);
    if (!oauthCookie || oauthCookie.state !== state) {
      logAuthEvent("invalid_state", {
        stateLength: state.length,
        hasOauthStateCookie: Boolean(oauthStateValue),
        ...readCookieDebugInfo(headers),
      });
      if (shouldPreferHtmlRedirect(headers)) {
        const redirectUrl = new URL(`${FRONTEND_URL}/me`);
        redirectUrl.searchParams.set("auth", "failed");
        set.status = 302;
        set.redirect = redirectUrl.toString();
        return;
      }
      return authError(set, 400, "INVALID_STATE", "Invalid or expired state");
    }
    clearOauthStateCookie(set);

    // Demo mode: bypass Casdoor and create a demo user directly
    if (code === "demo-auth-code" && DEMO_LOGIN) {
      const demoCasdoorId = `demo:${randomUUID()}`;
      const demoName = "智教联盟用户";
      const demoAvatar = "";
      const demoEmail = "demo@smart-teach.cn";

      let user = await findUserByCasdoorId(demoCasdoorId);
      if (!user) {
        user = await createUser({
          casdoor_id: demoCasdoorId,
          name: demoName,
          avatar_url: demoAvatar,
          email: demoEmail,
          role: "user",
          stcn_user_id: demoCasdoorId,
          stcn_username: demoName,
        });
      }

      if (!user) {
        return authError(set, 500, "DEMO_USER_CREATE_FAILED", "Failed to create demo user");
      }

      const jwt = signJwt({
        sub: user.id,
        name: user.name,
        role: user.role,
      });

      const wantsJson = wantsJsonCallbackResponse(query, headers);

      if (!wantsJson) {
        const popupPath = oauthCookie.popup ? "/auth/popup-callback" : "/me";
        const redirectUrl = new URL(`${FRONTEND_URL}${popupPath}`);
        redirectUrl.searchParams.set("auth", "success");
        const requested = oauthCookie.returnTo || "/";
        if (requested.startsWith("/")) redirectUrl.searchParams.set("returnTo", requested);
        setSessionCookie(set, jwt);
        set.status = 302;
        set.redirect = redirectUrl.toString();
        return;
      }

      return { token: jwt, user: { id: user.id, name: user.name, role: user.role, avatar_url: user.avatar_url } };
    }

    const tokenRes = await exchangeCodeForToken(code, oauthCookie.codeVerifier);
    if (!tokenRes) {
      return authError(set, 400, "TOKEN_EXCHANGE_FAILED", "Failed to exchange code for token");
    }

    const casdoorUser = await fetchCasdoorUser(tokenRes.access_token);
    if (!casdoorUser) {
      return authError(set, 400, "USERINFO_FETCH_FAILED", "Failed to fetch user info");
    }

    const account = casdoorUser.data ?? casdoorUser;
    const readString = (...values: unknown[]) => {
      for (const value of values) {
        if (typeof value !== "string") continue;
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      return "";
    };

    const casdoorId = readString(account?.id, account?.sub);
    const name = readString(account?.displayName, account?.name, account?.username, account?.preferred_username) || "User";
    const avatar = readString(account?.avatar, account?.picture);
    const email = readString(account?.email);
    const stcnUserId = readString(account?.id, account?.sub);
    const stcnUsername = readString(account?.name, account?.username, account?.preferred_username);

    if (!casdoorId) {
      return authError(set, 400, "INVALID_USERINFO", "Invalid user info from Casdoor");
    }

    let user = await findUserByCasdoorId(casdoorId);
    if (user) {
      user = await updateUserLogin(user.id, {
        name,
        avatar_url: avatar,
        avatar_source: avatar ? "casdoor" : user.avatar_source,
        email: email || null,
        stcn_user_id: stcnUserId || null,
        stcn_username: stcnUsername || null,
      });
    } else {
      user = await createUser({
        casdoor_id: casdoorId,
        name,
        avatar_url: avatar,
        avatar_source: avatar ? "casdoor" : "default",
        email: email || null,
        role: "user",
        stcn_user_id: stcnUserId || null,
        stcn_username: stcnUsername || null,
      });
    }

    if (!user) {
      return authError(set, 500, "USER_UPSERT_FAILED", "Failed to create or update user");
    }

    const jwt = signJwt({
      sub: user.id,
      name: user.name,
      role: user.role,
      tv: user.token_version ?? 0
    });

    const wantsJson = wantsJsonCallbackResponse(query, headers);

    if (!wantsJson) {
      const popupPath = oauthCookie.popup ? "/auth/popup-callback" : "/me";
      const redirectUrl = new URL(`${FRONTEND_URL}${popupPath}`);
      redirectUrl.searchParams.set("auth", "success");
      const requested = oauthCookie.returnTo || "/";
      if (requested.startsWith("/")) redirectUrl.searchParams.set("returnTo", requested);
      set.status = 302;
      setSessionCookie(set, jwt);
      set.redirect = redirectUrl.toString();
      return;
    }

    return { token: jwt, user: { id: user.id, name: user.name, role: user.role, avatar_url: user.avatar_url } };
  })
  .get("/me", async ({ headers, set }) => {
    const cookies = parseCookieHeader(headers["cookie"]);
    const authHeader = headers["authorization"] ?? "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = cookies[appConfig.sessionCookieName] || bearerMatch?.[1];
    if (!token) {
      return authError(set, 401, "UNAUTHORIZED", "Unauthorized");
    }

    const { verifyJwt } = await import("../utils/jwt");
    const { findLocalAccountByUsername } = await import("../services/localAccounts");
    const payload = verifyJwt(token);
    if (!payload) {
      return authError(set, 401, "INVALID_TOKEN", "Invalid token");
    }
    if (!payload.name) {
      return authError(set, 401, "INVALID_TOKEN", "Invalid token");
    }

    const subject = payload.sub;

    let user =
      subject.startsWith(JWT_SUB_LOCAL_PREFIX)
        ? await (async () => {
            const localId = subject.slice(JWT_SUB_LOCAL_PREFIX.length);
            if (!isAllowedLocalSubjectId(localId)) return null;

            const account = await findLocalAccountByUsername(payload.name);
            if (!account || account.id !== localId || !account.is_active) return null;

            const u = await findUserByName(account.username);
            if (!u || !u.is_active) return null;
            return u;
          })()
        : subject.startsWith(JWT_SUB_TOKEN_PREFIX)
          ? null
          : await (async () => {
              const u = await findUserById(subject);
              if (!u || !u.is_active) return null;
              if ((payload.tv ?? 0) !== (u.token_version ?? 0)) return null;
              return u;
            })();

    if (!user || !user.is_active) {
      return authError(set, 401, "UNAUTHORIZED", "User not found or inactive");
    }

    const capInfo = await getUserCapabilitiesWithInfo(user.id, user.name);

    const { getUserOrganizations } = await import("../services/organizations");
    const organizations = PG_ENABLED ? await getUserOrganizations(user.id) : [];

    return {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        avatar_source: user.avatar_source,
        email: user.email,
        stcn_user_id: user.stcn_user_id,
        stcn_username: user.stcn_username,
        hzzc_user_id: user.hzzc_user_id,
      },
      is_superadmin: capInfo.is_superadmin,
      capabilities: capInfo.capabilities,
      organizations,
    };
  })
  .post("/logout", async ({ user, set, headers }) => {
    if (user?.id && !String(user.id).startsWith("local:") && !String(user.id).startsWith("token:")) {
      await bumpUserTokenVersion(user.id).catch(() => {});
    }
    clearSessionCookie(set);
    logAuthEvent("logout", {
      userId: user?.id ?? null,
      ...readCookieDebugInfo(headers),
    });
    return { success: true };
  });
