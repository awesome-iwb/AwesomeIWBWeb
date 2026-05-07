import { createHmac } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export type JwtPayload = {
  sub: string;
  name: string;
  role: "user" | "dev" | "ops";
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padding = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + padding;
  return Buffer.from(base64, "base64").toString("utf-8");
}

function hmacSha256(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, expiresInSeconds = 7 * 24 * 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = hmacSha256(`${header}.${body}`, JWT_SECRET);

  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = hmacSha256(`${header}.${body}`, JWT_SECRET);
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return createHmac("sha256", JWT_SECRET).update(token).digest("hex");
}
