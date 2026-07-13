import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import { appConfig } from "../config";

const DEFAULT_ROOT = path.join(__dirname, "../../runtime/media");
const DEFAULT_LEGACY_ROOT = path.join(__dirname, "../../runtime/uploads");

export type StorageLayout = "legacy" | "v2";
export type StoredFile = { buffer: Buffer; size: number; modifiedAt: Date };

export function getStorageRoot(): string {
  return appConfig.storage.root || DEFAULT_ROOT;
}

export function getLegacyStorageRoot(): string {
  return appConfig.storage.legacyRoot || DEFAULT_LEGACY_ROOT;
}

export function normalizeStorageKey(key: string): string {
  const raw = String(key ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!raw) throw new Error("INVALID_STORAGE_KEY");
  const parts = raw.split("/");
  if (path.isAbsolute(raw) || parts.some((part) => !part || part === "." || part === ".." || /[\x00-\x1f\x7f]/.test(part))) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return parts.join("/");
}

function rootFor(layout: StorageLayout): string {
  return layout === "legacy" ? getLegacyStorageRoot() : getStorageRoot();
}

function resolveKeyPath(key: string, layout: StorageLayout): string {
  const safeKey = normalizeStorageKey(key);
  const root = path.resolve(rootFor(layout));
  const fullPath = path.resolve(root, ...safeKey.split("/"));
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) throw new Error("INVALID_STORAGE_KEY");
  return fullPath;
}

export function buildKey(filename: string, grouping?: string, entityType?: string): string {
  const safeFilename = normalizeStorageKey(filename);
  const strategy = grouping || appConfig.storage.grouping;
  if (strategy === "dated") {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${safeFilename}`;
  }
  if (strategy === "entity" && entityType) return `${normalizeStorageKey(entityType)}/${safeFilename}`;
  return safeFilename;
}

export function buildObjectKey(sha256: string, extension: string): string {
  const hash = String(sha256 ?? "").trim().toLowerCase();
  const ext = String(extension ?? "").trim().toLowerCase().replace(/^\./, "");
  if (!/^[0-9a-f]{64}$/.test(hash) || !/^[a-z0-9]{2,8}$/.test(ext)) throw new Error("INVALID_OBJECT_IDENTITY");
  return `objects/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;
}

export function buildVariantKey(sha256: string, width: number, transformVersion = 1): string {
  const hash = String(sha256 ?? "").trim().toLowerCase();
  if (
    !/^[0-9a-f]{64}$/.test(hash)
    || !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(transformVersion)
    || transformVersion <= 0
  ) {
    throw new Error("INVALID_VARIANT_IDENTITY");
  }
  return `derivatives/sha256/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}/v${transformVersion}/w${width}.webp`;
}

async function hashFile(fullPath: string): Promise<string> {
  return crypto.createHash("sha256").update(await fs.readFile(fullPath)).digest("hex");
}

async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await fs.open(directory, fsConstants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeFile(
  key: string,
  buffer: Buffer,
  options: { expectedSha256?: string; layout?: StorageLayout } = {},
): Promise<string> {
  const layout = options.layout ?? "v2";
  const fullPath = resolveKeyPath(key, layout);
  const expected = options.expectedSha256?.toLowerCase();
  if (expected && !/^[0-9a-f]{64}$/.test(expected)) throw new Error("INVALID_EXPECTED_SHA256");
  const incomingHash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (expected && incomingHash !== expected) throw new Error("STORAGE_CHECKSUM_MISMATCH");
  await fs.mkdir(path.dirname(fullPath), { recursive: true, mode: 0o750 });
  try {
    const stat = await fs.stat(fullPath);
    if (stat.size !== buffer.length || (await hashFile(fullPath)) !== incomingHash) throw new Error("STORAGE_OBJECT_CONFLICT");
    return fullPath;
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  const tempPath = path.join(path.dirname(fullPath), `.${path.basename(fullPath)}.${crypto.randomUUID()}.partial`);
  const handle = await fs.open(tempPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o640);
  try {
    await handle.writeFile(buffer);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.link(tempPath, fullPath);
  } catch (error: any) {
    if (error?.code !== "EEXIST") throw error;
    const stat = await fs.stat(fullPath);
    if (stat.size !== buffer.length || (await hashFile(fullPath)) !== incomingHash) throw new Error("STORAGE_OBJECT_CONFLICT");
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
  await syncDirectory(path.dirname(fullPath));
  return fullPath;
}

export async function readFile(key: string, layout: StorageLayout = "v2"): Promise<StoredFile | null> {
  const fullPath = resolveKeyPath(key, layout);
  try {
    const [buffer, stat] = await Promise.all([fs.readFile(fullPath), fs.stat(fullPath)]);
    return { buffer, size: stat.size, modifiedAt: stat.mtime };
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function publicUrl(key: string): string {
  return `${appConfig.storage.publicPrefix}/${normalizeStorageKey(key)}`;
}

export function resolveKeyFromUrl(url: string): string | null {
  const prefix = appConfig.storage.publicPrefix;
  if (!url.startsWith(prefix + "/")) return null;
  try { return normalizeStorageKey(url.slice(prefix.length + 1)); } catch { return null; }
}

export async function ensureRoot(): Promise<void> {
  await Promise.all([
    fs.mkdir(getStorageRoot(), { recursive: true, mode: 0o750 }),
    fs.mkdir(getLegacyStorageRoot(), { recursive: true, mode: 0o750 }),
    fs.mkdir(path.join(getStorageRoot(), "staging"), { recursive: true, mode: 0o750 }),
  ]);
}

export function resolveStoragePath(key: string, layout: StorageLayout = "v2"): string {
  return resolveKeyPath(key, layout);
}

export async function fileExists(key: string, layout: StorageLayout = "v2"): Promise<boolean> {
  try {
    await fs.access(resolveStoragePath(key, layout));
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function deleteFile(key: string, layout: StorageLayout = "v2"): Promise<boolean> {
  try { await fs.unlink(resolveStoragePath(key, layout)); return true; }
  catch (error: any) { if (error?.code === "ENOENT") return false; throw error; }
}

export async function moveFile(fromKey: string, toKey: string, layout: StorageLayout = "legacy"): Promise<void> {
  const fromPath = resolveStoragePath(fromKey, layout);
  const toPath = resolveStoragePath(toKey, layout);
  await fs.mkdir(path.dirname(toPath), { recursive: true, mode: 0o750 });
  await fs.rename(fromPath, toPath);
}

export function thumbSidecarKey(sourceKey: string, width: number): string {
  const safeKey = normalizeStorageKey(sourceKey);
  const dir = path.posix.dirname(safeKey);
  const base = path.posix.basename(safeKey, path.posix.extname(safeKey));
  const name = `${base}.w${Math.max(1, Math.floor(width))}.webp`;
  return dir === "." ? name : `${dir}/${name}`;
}
