import path from "path";
import fs from "fs/promises";
import { appConfig } from "../config";

const DEFAULT_ROOT = path.join(__dirname, "../../runtime/uploads");

export function getStorageRoot(): string {
  return appConfig.storage.root || DEFAULT_ROOT;
}

function getRoot(): string {
  return getStorageRoot();
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

export function resolveStoragePath(key: string): string {
  validateKey(key);
  return path.join(getRoot(), key);
}

export async function fileExists(key: string): Promise<boolean> {
  validateKey(key);
  try {
    await fs.access(resolveStoragePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<boolean> {
  validateKey(key);
  try {
    await fs.unlink(resolveStoragePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function moveFile(fromKey: string, toKey: string): Promise<void> {
  validateKey(fromKey);
  validateKey(toKey);
  const fromPath = resolveStoragePath(fromKey);
  const toPath = resolveStoragePath(toKey);
  await fs.mkdir(path.dirname(toPath), { recursive: true });
  await fs.rename(fromPath, toPath);
}

/** Sidecar thumbnail key: `content/abc.jpg` -> `content/abc.w200.webp` */
export function thumbSidecarKey(sourceKey: string, width: number): string {
  validateKey(sourceKey);
  const dir = path.posix.dirname(sourceKey);
  const base = path.posix.basename(sourceKey, path.posix.extname(sourceKey));
  const thumbName = `${base}.w${Math.max(1, Math.floor(width))}.webp`;
  return dir === "." ? thumbName : `${dir}/${thumbName}`;
}
