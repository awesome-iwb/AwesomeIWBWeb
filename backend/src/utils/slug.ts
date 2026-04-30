import { randomUUID } from "crypto";

export function newSlug() {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

