import path from "path";
import fs from "fs/promises";
import { appConfig } from "../config";

const DEFAULT_ROOT = path.join(__dirname, "../../runtime/uploads");

function getRoot(): string {
  return appConfig.storage.root || DEFAULT_ROOT;
}

function validateKey(key: string): void {
  if (key.includes("..")) {
    throw new Error("存储 key 包含非法路径");
  }
}

export function buildKey(filename: string, grouping?: string, entityType?: string): string {
  const strategy = grouping || appConfig.storage.grouping;
  switch (strategy) {
    case "dated": {
      const now = new Date();
      const y = now.getFullYear().toString();
      const m = (now.getMonth() + 1).toString().padStart(2, "0");
      const d = now.getDate().toString().padStart(2, "0");
      return `${y}/${m}/${d}/${filename}`;
    }
    case "entity":
      return entityType ? `${entityType}/${filename}` : filename;
    default:
      return filename;
  }
}

export async function writeFile(key: string, buffer: Buffer): Promise<string> {
  validateKey(key);
  const fullPath = path.join(getRoot(), key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await Bun.write(fullPath, buffer);
  return fullPath;
}

export async function readFile(key: string) {
  validateKey(key);
  const fullPath = path.join(getRoot(), key);
  return Bun.file(fullPath);
}

export function publicUrl(key: string): string {
  const prefix = appConfig.storage.publicPrefix;
  return `${prefix}/${key}`;
}

export function resolveKeyFromUrl(url: string): string | null {
  const prefix = appConfig.storage.publicPrefix;
  if (!url.startsWith(prefix + "/")) return null;
  return url.slice(prefix.length + 1);
}

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(getRoot(), { recursive: true });
}
