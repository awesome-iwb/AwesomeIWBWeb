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

export function normalizeStorageKey(key: string): string {
  const raw = String(key ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!raw) throw new Error("INVALID_STORAGE_KEY");

  const parts = raw.split("/");
  if (
    path.isAbsolute(raw) ||
    parts.some((part) => !part || part === "." || part === ".." || /[\x00-\x1f\x7f]/.test(part))
  ) {
    throw new Error("INVALID_STORAGE_KEY");
  }

  return parts.join("/");
}

function resolveKeyPath(key: string): string {
  const safeKey = normalizeStorageKey(key);
  const root = path.resolve(getRoot());
  const fullPath = path.resolve(root, ...safeKey.split("/"));
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return fullPath;
}

export function buildKey(filename: string, grouping?: string, entityType?: string): string {
  const safeFilename = normalizeStorageKey(filename);
  const strategy = grouping || appConfig.storage.grouping;
  switch (strategy) {
    case "dated": {
      const now = new Date();
      const y = now.getFullYear().toString();
      const m = (now.getMonth() + 1).toString().padStart(2, "0");
      const d = now.getDate().toString().padStart(2, "0");
      return `${y}/${m}/${d}/${safeFilename}`;
    }
    case "entity":
      return entityType ? `${normalizeStorageKey(entityType)}/${safeFilename}` : safeFilename;
    default:
      return safeFilename;
  }
}

export async function writeFile(key: string, buffer: Buffer): Promise<string> {
  const fullPath = resolveKeyPath(key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await Bun.write(fullPath, buffer);
  return fullPath;
}

export async function readFile(key: string) {
  const fullPath = resolveKeyPath(key);
  return Bun.file(fullPath);
}

export function publicUrl(key: string): string {
  const prefix = appConfig.storage.publicPrefix;
  return `${prefix}/${normalizeStorageKey(key)}`;
}

export function resolveKeyFromUrl(url: string): string | null {
  const prefix = appConfig.storage.publicPrefix;
  if (!url.startsWith(prefix + "/")) return null;
  try {
    return normalizeStorageKey(url.slice(prefix.length + 1));
  } catch {
    return null;
  }
}

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(getRoot(), { recursive: true });
}

export function resolveStoragePath(key: string): string {
  return resolveKeyPath(key);
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveStoragePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<boolean> {
  try {
    await fs.unlink(resolveStoragePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function moveFile(fromKey: string, toKey: string): Promise<void> {
  const fromPath = resolveStoragePath(fromKey);
  const toPath = resolveStoragePath(toKey);
  await fs.mkdir(path.dirname(toPath), { recursive: true });
  await fs.rename(fromPath, toPath);
}

/** Sidecar thumbnail key: `content/abc.jpg` -> `content/abc.w200.webp` */
export function thumbSidecarKey(sourceKey: string, width: number): string {
  const safeKey = normalizeStorageKey(sourceKey);
  const dir = path.posix.dirname(safeKey);
  const base = path.posix.basename(safeKey, path.posix.extname(safeKey));
  const thumbName = `${base}.w${Math.max(1, Math.floor(width))}.webp`;
  return dir === "." ? thumbName : `${dir}/${thumbName}`;
}
