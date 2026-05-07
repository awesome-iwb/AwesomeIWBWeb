import { Elysia } from "elysia";
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { signJwt } from "../utils/jwt";
import { bumpUserTokenVersion, createUser, findUserByCasdoorId, updateUserLogin } from "../services/users";
import { appConfig } from "../config";
import { clearSessionCookie, parseCookieHeader, setSessionCookie } from "../utils/cookies";
import { checkRateLimit } from "./rateLimit";

const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT ?? "";
const CASDOOR_CLIENT_ID = process.env.CASDOOR_CLIENT_ID ?? "";
const CASDOOR_CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET ?? "";
const CASDOOR_ORGANIZATION = process.env.CASDOOR_ORGANIZATION_NAME ?? "stcn";
const CASDOOR_APPLICATION = process.env.CASDOOR_APPLICATION_NAME ?? "awesome-iwb";
const CASDOOR_REDIRECT_URI = process.env.CASDOOR_REDIRECT_URI ?? "http://localhost:5173/me";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const stateStore = new Map<string, { createdAt: number }>();
const OAUTH_STATE_COOKIE = "awesomeiwb_oauth_state";

function cleanOldStates() {
  const now = Date.now();
  for (const [key, val] of stateStore.entries()) {
    if (now - val.createdAt > 10 * 60 * 1000) {
      stateStore.delete(key);
    }
  }
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signState(value: string): string {
  return createHmac("sha256", appConfig.jwtSecret).update(value).digest("hex");
}

function encodeStateCookie(payload: { state: string; codeVerifier: string; returnTo: string }) {
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
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf-8")) as { state: string; codeVerifier: string; returnTo: string };
  } catch {
    return null;
  }
}

function setOauthStateCookie(set: any, payload: { state: string; codeVerifier: string; returnTo: string }) {
  const value = encodeStateCookie(payload);
  const parts = [`${OAUTH_STATE_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=600"];
  if (appConfig.isProduction) parts.push("Secure");
  if (appConfig.cookieDomain) parts.push(`Domain=${appConfig.cookieDomain}`);
  set.headers["set-cookie"] = parts.join("; ");
}

function clearOauthStateCookie(set: any) {
  const parts = [`${OAUTH_STATE_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (appConfig.isProduction) parts.push("Secure");
  if (appConfig.cookieDomain) parts.push(`Domain=${appConfig.cookieDomain}`);
  set.headers["set-cookie"] = parts.join("; ");
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
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);
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
  if (!res.ok) return null;
  return await res.json();
}

// Demo mode: when Casdoor is not configured, simulate a login redirect
// that creates a demo user. Set DEMO_LOGIN=true to enable.
const DEMO_LOGIN = process.env.DEMO_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const casdoorAuthPlugin = new Elysia({ prefix: "/api/auth" })
  .get("/login", ({ set, query, headers }) => {
    if (checkRateLimit({ headers, path: "/api/auth/casdoor/login", set })) return { error: "Too Many Requests" };
    if (!appConfig.oauthEnabled) {
      set.status = 503;
      return { error: "OAuth disabled by OAUTH_ENABLED=false" };
    }
    if (!CASDOOR_ENDPOINT || !CASDOOR_CLIENT_ID) {
      if (DEMO_LOGIN) {
        // Simulate Casdoor login by redirecting directly to callback with a demo code
        const state = randomUUID();
        stateStore.set(state, { createdAt: Date.now() });
        const demoCallbackUrl = new URL(`${FRONTEND_URL}/me`);
        demoCallbackUrl.searchParams.set("code", "demo-auth-code");
        demoCallbackUrl.searchParams.set("state", state);
        return { authorizeUrl: demoCallbackUrl.toString() };
      }
      set.status = 503;
      return { error: "Casdoor not configured" };
    }
    cleanOldStates();
    const state = randomUUID();
    const codeVerifier = base64Url(randomBytes(32));
    const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());
    const returnToRaw = typeof (query as any)?.returnTo === "string" ? String((query as any).returnTo) : "/";
    const returnTo = pickSafeReturnTo(returnToRaw);
    stateStore.set(state, { createdAt: Date.now() });
    setOauthStateCookie(set, { state, codeVerifier, returnTo });
    return { authorizeUrl: buildAuthorizeUrl(state, codeChallenge) };
  })
  .get("/callback", async ({ query, set, headers }) => {
    if (checkRateLimit({ headers, path: "/api/auth/casdoor/callback", set })) return { error: "Too Many Requests" };
    if (!appConfig.oauthEnabled) {
      set.status = 503;
      return { error: "OAuth disabled by OAUTH_ENABLED=false" };
    }
    const code = String((query as any)?.code ?? "");
    const state = String((query as any)?.state ?? "");

    if (!code || !state) {
      set.status = 400;
      return { error: "Missing code or state" };
    }
    const stateEntry = stateStore.get(state);
    const oauthCookie = decodeStateCookie(parseCookieHeader(headers["cookie"])[OAUTH_STATE_COOKIE]);
    if (!stateEntry || !oauthCookie || oauthCookie.state !== state) {
      set.status = 400;
      return { error: "Invalid or expired state" };
    }
    stateStore.delete(state);
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
        });
      }

      if (!user) {
        set.status = 500;
        return { error: "Failed to create demo user" };
      }

      const jwt = signJwt({
        sub: user.id,
        name: user.name,
        role: user.role,
      });

      const acceptHeader = headers["accept"] ?? "";
      const isBrowserRedirect = acceptHeader.includes("text/html");

      if (isBrowserRedirect) {
        const redirectUrl = new URL(`${FRONTEND_URL}/me`);
        redirectUrl.searchParams.set("token", jwt);
        redirectUrl.searchParams.set("user_id", user.id);
        redirectUrl.searchParams.set("user_name", user.name);
        redirectUrl.searchParams.set("user_role", user.role);
        set.status = 302;
        set.redirect = redirectUrl.toString();
        return;
      }

      return { token: jwt, user: { id: user.id, name: user.name, role: user.role, avatar_url: user.avatar_url } };
    }

    const tokenRes = await exchangeCodeForToken(code, oauthCookie.codeVerifier);
    if (!tokenRes) {
      set.status = 400;
      return { error: "Failed to exchange code for token" };
    }

    const casdoorUser = await fetchCasdoorUser(tokenRes.access_token);
    if (!casdoorUser) {
      set.status = 400;
      return { error: "Failed to fetch user info" };
    }

    const account = casdoorUser.data ?? casdoorUser;
    const casdoorId = String(account?.id ?? account?.sub ?? "");
    const name = String(account?.displayName ?? account?.name ?? account?.username ?? "User");
    const avatar = String(account?.avatar ?? "");
    const email = String(account?.email ?? "");

    if (!casdoorId) {
      set.status = 400;
      return { error: "Invalid user info from Casdoor" };
    }

    let user = await findUserByCasdoorId(casdoorId);
    if (user) {
      user = await updateUserLogin(user.id, {
        name,
        avatar_url: avatar,
        email,
      });
    } else {
      user = await createUser({
        casdoor_id: casdoorId,
        name,
        avatar_url: avatar,
        email,
        role: "user",
      });
    }

    if (!user) {
      set.status = 500;
      return { error: "Failed to create or update user" };
    }

    const jwt = signJwt({
      sub: user.id,
      name: user.name,
      role: user.role,
      tv: user.token_version ?? 0
    });

    // Check if this is a browser redirect (has Accept: text/html) or an API call
    const acceptHeader = headers["accept"] ?? "";
    const isBrowserRedirect = acceptHeader.includes("text/html");

    if (isBrowserRedirect) {
      const redirectUrl = new URL(FRONTEND_URL);
      const requested = oauthCookie.returnTo || "/";
      if (requested.startsWith("/")) redirectUrl.pathname = requested;
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
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { verifyJwt } = await import("../utils/jwt");
    const { findUserById } = await import("../services/users");
    const payload = verifyJwt(token);
    if (!payload) {
      set.status = 401;
      return { error: "Invalid token" };
    }

    const user = await findUserById(payload.sub);
    if (!user || !user.is_active) {
      set.status = 401;
      return { error: "User not found or inactive" };
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        email: user.email,
        stcn_user_id: user.stcn_user_id,
        sectl_user_id: user.sectl_user_id,
        lincube_user_id: user.lincube_user_id,
      },
    };
  })
  .post("/logout", async ({ user, set }) => {
    if (user?.id && !String(user.id).startsWith("local:") && !String(user.id).startsWith("token:")) {
      await bumpUserTokenVersion(user.id).catch(() => {});
    }
    clearSessionCookie(set);
    return { success: true };
  });
