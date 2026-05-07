import { appConfig } from "../config";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getClientIp(headers: Record<string, string | undefined>) {
  return (headers["x-forwarded-for"] ?? headers["x-real-ip"] ?? "unknown").split(",")[0].trim();
}

export function checkRateLimit(input: { headers: Record<string, string | undefined>; path: string; set: any }) {
  const ip = getClientIp(input.headers);
  const key = `${ip}:${input.path}`;
  const now = Date.now();
  const windowMs = appConfig.rateLimitWindowMs;
  const max = appConfig.rateLimitMax;
  const current = buckets.get(key);
  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (current.count >= max) {
    input.set.status = 429;
    input.set.headers["retry-after"] = String(Math.ceil((current.resetAt - now) / 1000));
    return true;
  }
  current.count += 1;
  return false;
}
