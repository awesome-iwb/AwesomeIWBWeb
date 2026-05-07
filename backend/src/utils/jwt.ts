import { createHmac, timingSafeEqual } from "crypto";
import { appConfig } from "../config";

export type JwtPayload = {
  sub: string;
  name: string;
  role: "user" | "dev" | "ops";
  iss: string;
  aud: string;
  iat: number;
  nbf: number;
  exp: number;
  tv?: number;
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
    iss: appConfig.jwtIssuer,
    aud: appConfig.jwtAudience,
    ...payload,
    iat: now,
    nbf: now,
    exp: now + expiresInSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = hmacSha256(`${header}.${body}`, appConfig.jwtSecret);

  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string, input?: { iss?: string; aud?: string }): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = hmacSha256(`${header}.${body}`, appConfig.jwtSecret);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.nbf && payload.nbf > now) return null;
    if (payload.exp && payload.exp < now) return null;
    if ((input?.iss ?? appConfig.jwtIssuer) !== payload.iss) return null;
    if ((input?.aud ?? appConfig.jwtAudience) !== payload.aud) return null;

    return payload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return createHmac("sha256", appConfig.jwtSecret).update(token).digest("hex");
}
