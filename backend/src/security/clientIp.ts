import { appConfig } from "../config";

function headerValue(headers: Record<string, string | undefined>, name: string): string {
  return headers[name] ?? headers[name.toLowerCase()] ?? "";
}

function firstHeaderIp(raw: string): string {
  return raw.split(",")[0]?.trim() || "";
}

export function getClientIp(
  headers: Record<string, string | undefined>,
  opts: { trustProxy?: boolean } = {}
): string {
  if (!(opts.trustProxy ?? appConfig.trustProxy)) return "direct";

  const forwarded = firstHeaderIp(headerValue(headers, "x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = headerValue(headers, "x-real-ip").trim();
  if (realIp) return realIp;

  return "unknown";
}
