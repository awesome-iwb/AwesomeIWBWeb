import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { projectKeyFrom } from '../domain/projectKey';

type Catalog = {
  categories: Array<{
    projects: Array<Record<string, any>>;
  }>;
};

const repoRoot = path.join(import.meta.dir, '../../..');
const dataPath = path.join(repoRoot, 'backend/src/data.json');
const publicDir = path.join(repoRoot, 'frontend/public');
const assetsProjectsDir = path.join(publicDir, 'assets/projects');

const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });

const slugify = (input: string) =>
  input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'project';

const stableSuffix = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 6);

const toPublicAbs = (publicPath: string) => path.join(publicDir, publicPath.replace(/^\//, ''));

const extFrom = (v: string) => {
  const ext = path.extname(v).toLowerCase();
  if (!ext) return '.webp';
  const allowed = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif', '.ico']);
  if (allowed.has(ext)) return ext;
  return '.webp';
};

const chooseKey = (p: Record<string, any>, seen: Map<string, number>) => {
  const base = projectKeyFrom({ slug: p.slug, name: p.name, github_url: p.github_url });
  const bump = seen.get(base) ?? 0;
  seen.set(base, bump + 1);
  if (bump === 0) return base;
  const salt = p.github_url || p.name || String(bump);
  return `${base}-${stableSuffix(salt)}`;
};

export const rewriteProjectAssets = (catalog: Catalog) => {
  const out = structuredClone(catalog) as Catalog;
  const seen = new Map<string, number>();
  for (const c of out.categories) {
    for (const p of c.projects) {
      const key = chooseKey(p, seen);
      const base = `/assets/projects/${key}`;

      const rewriteField = (field: 'icon' | 'banner' | 'avatar') => {
        const v = p[field];
        if (!v || typeof v !== 'string') return;
        const ext = v.startsWith('http') ? extFrom(new URL(v).pathname) : extFrom(v);
        p[field] = `${base}/${field}${ext}`;
      };

      rewriteField('icon');
      rewriteField('banner');
      rewriteField('avatar');
    }
  }
  return out;
};

const copyLocal = (srcAbs: string, destAbs: string) => {
  ensureDir(path.dirname(destAbs));
  if (!fs.existsSync(destAbs)) fs.copyFileSync(srcAbs, destAbs);
};

const downloadTo = async (url: string, destAbs: string) => {
  ensureDir(path.dirname(destAbs));
  if (fs.existsSync(destAbs)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destAbs, buf);
};

const applyFileOps = async (before: Catalog, after: Catalog) => {
  const beforeProjects = before.categories.flatMap((c: any) => c.projects);
  const afterProjects = after.categories.flatMap((c: any) => c.projects);

  for (let i = 0; i < afterProjects.length; i++) {
    const bp = beforeProjects[i] as any;
    const ap = afterProjects[i] as any;
    for (const field of ['icon', 'banner', 'avatar'] as const) {
      const oldV = bp[field];
      const newV = ap[field];
      if (!oldV || !newV) continue;
      if (typeof oldV !== 'string' || typeof newV !== 'string') continue;
      if (!newV.startsWith('/assets/projects/')) continue;

      const destAbs = toPublicAbs(newV);

      if (oldV.startsWith('/')) {
        const srcAbs = toPublicAbs(oldV);
        if (fs.existsSync(srcAbs)) copyLocal(srcAbs, destAbs);
        else ap[field] = oldV;
      } else if (oldV.startsWith('http')) {
        try {
          await downloadTo(oldV, destAbs);
        } catch {
          ap[field] = oldV;
        }
      }
    }
  }
};

if (import.meta.main) {
  ensureDir(assetsProjectsDir);
  const before = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Catalog;
  const after = rewriteProjectAssets(before);
  await applyFileOps(before, after);
  fs.writeFileSync(dataPath, JSON.stringify(after, null, 2));
  console.log('project asset migration done');
}
