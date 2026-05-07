import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import { signJwt } from "../utils/jwt";
import { findUserByCasdoorId, createUser, updateUserLogin } from "../services/users";

const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT ?? "";
const CASDOOR_CLIENT_ID = process.env.CASDOOR_CLIENT_ID ?? "";
const CASDOOR_CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET ?? "";
const CASDOOR_ORGANIZATION = process.env.CASDOOR_ORGANIZATION_NAME ?? "stcn";
const CASDOOR_APPLICATION = process.env.CASDOOR_APPLICATION_NAME ?? "awesome-iwb";
const CASDOOR_REDIRECT_URI = process.env.CASDOOR_REDIRECT_URI ?? "http://localhost:5173/me";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const stateStore = new Map<string, { createdAt: number }>();

function cleanOldStates() {
  const now = Date.now();
  for (const [key, val] of stateStore.entries()) {
    if (now - val.createdAt > 10 * 60 * 1000) {
      stateStore.delete(key);
    }
  }
}

function buildAuthorizeUrl(state: string): string {
  const url = new URL(`${CASDOOR_ENDPOINT}/login/oauth/authorize`);
  url.searchParams.set("client_id", CASDOOR_CLIENT_ID);
  url.searchParams.set("redirect_uri", CASDOOR_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCodeForToken(code: string): Promise<{ access_token: string } | null> {
  const res = await fetch(`${CASDOOR_ENDPOINT}/api/login/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CASDOOR_CLIENT_ID,
      client_secret: CASDOOR_CLIENT_SECRET,
      code,
      redirect_uri: CASDOOR_REDIRECT_URI,
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
const DEMO_LOGIN = process.env.DEMO_LOGIN === "true";

export const casdoorAuthPlugin = new Elysia({ prefix: "/api/auth" })
  .get("/login", ({ set }) => {
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
    stateStore.set(state, { createdAt: Date.now() });
    return { authorizeUrl: buildAuthorizeUrl(state) };
  })
  .get("/callback", async ({ query, set, headers }) => {
    const code = String((query as any)?.code ?? "");
    const state = String((query as any)?.state ?? "");

    if (!code || !state) {
      set.status = 400;
      return { error: "Missing code or state" };
    }
    if (!stateStore.has(state)) {
      set.status = 400;
      return { error: "Invalid or expired state" };
    }
    stateStore.delete(state);

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

    const tokenRes = await exchangeCodeForToken(code);
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
    });

    // Check if this is a browser redirect (has Accept: text/html) or an API call
    const acceptHeader = headers["accept"] ?? "";
    const isBrowserRedirect = acceptHeader.includes("text/html");

    if (isBrowserRedirect) {
      // Redirect back to frontend with token in URL hash (safer than query param)
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
  })
  .get("/me", async ({ headers, set }) => {
    const authHeader = headers["authorization"] ?? "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { verifyJwt } = await import("../utils/jwt");
    const { findUserById } = await import("../services/users");
    const payload = verifyJwt(bearerMatch[1]);
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
  .post("/logout", () => {
    return { success: true };
  });
