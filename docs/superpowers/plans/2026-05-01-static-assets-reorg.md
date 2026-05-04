# 静态资源规范化（P1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将网站品牌/UI/合作方/项目资源彻底分层到 `frontend/public/assets/**`，并把项目 icon/banner/avatar 统一迁移到 `assets/projects/<project-key>/**`（P1），同时保持站点可运行、可验证、并提供过渡期兼容。

**Architecture:** 使用“新目录 + 更新引用”的渐进迁移。项目资源迁移采用脚本批量生成 `<project-key>` 并复制文件到 canonical 目录，同时更新 `backend/src/data.json` 中的资源字段指向新路径。过渡期保留旧文件不删除，避免外部硬编码链接立即失效。

**Tech Stack:** Vue 3 + Vite, Bun, bun:test, Node/Bun filesystem, Python（现有脚本）。

---

## 文件结构变更概览

**Create**
- `frontend/public/assets/brand/`（目录）
- `frontend/public/assets/ui/`（目录）
- `frontend/public/assets/partners/`（目录）
- `frontend/public/assets/projects/`（目录）
- `frontend/public/assets/projects-cache/`（目录）
- `backend/src/domain/projectKey.ts`
- `backend/src/domain/projectKey.test.ts`
- `backend/src/scripts/migrate-project-assets.ts`
- `backend/src/scripts/migrate-project-assets.test.ts`
- `scripts/check-assets.js`（node 脚本，用于 CI/本地校验；只做只读扫描）
- `frontend/src/assets/__tests__/assetPaths.test.ts`

**Modify**
- `frontend/src/components/BrandMark.vue`
- `frontend/src/components/SiteFooter.vue`
- `frontend/src/components/NavBar.vue`
- `backend/src/data.json`
- `backend/src/download_images.py`

---

### Task 1: 创建新目录与资源校验脚本

**Files:**
- Create: `frontend/public/assets/{brand,ui,partners,projects,projects-cache}/`（目录）
- Create: `scripts/check-assets.js`

- [ ] **Step 1: 创建 assets 目录**

Run:
```bash
mkdir -p frontend/public/assets/{brand,ui,partners,projects,projects-cache}
```

- [ ] **Step 2: 添加资源校验脚本（先写 failing test 见 Task 2/3）**

Create `scripts/check-assets.js` with:
```js
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'frontend', 'public');

const forbiddenRoots = [
  path.join(publicDir, 'images'),
  path.join(publicDir, 'banner')
];

const forbiddenPatterns = [
  /-icon\.(png|webp|jpg|jpeg|svg|ico)$/i,
  /-banner\.(png|webp|jpg|jpeg|svg|gif)$/i
];

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};

const offenders = [];
for (const root of forbiddenRoots) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    const base = path.basename(f);
    if (forbiddenPatterns.some((re) => re.test(base))) offenders.push(path.relative(repoRoot, f));
  }
}

if (offenders.length) {
  console.error('Found forbidden asset placements:');
  for (const f of offenders) console.error(`- ${f}`);
  process.exit(1);
}

console.log('asset placement check: ok');
```

- [ ] **Step 3: 手动运行一次脚本（允许失败，作为当前基线）**

Run:
```bash
node scripts/check-assets.js
```

Expected: 当前仓库大概率会 FAIL（因为历史资源混放），后续迁移完成后应 PASS。

---

### Task 2: 迁移品牌/UI/合作方资源，并更新前端引用（不动项目资源）

**Files:**
- Modify: `frontend/src/components/BrandMark.vue`
- Modify: `frontend/src/components/SiteFooter.vue`
- Modify: `frontend/src/components/NavBar.vue`
- Create: `frontend/src/assets/__tests__/assetPaths.test.ts`

- [ ] **Step 1: 写 failing test（验证 BrandMark/SiteFooter 不再引用 /images 根目录品牌资源）**

Create `frontend/src/assets/__tests__/assetPaths.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('asset paths', () => {
  test('BrandMark uses /assets/brand', () => {
    const s = read('src/components/BrandMark.vue');
    expect(s.includes('src="/assets/brand/')).toBe(true);
    expect(s.includes('src="/images/aiwb-icon')).toBe(false);
  });

  test('Footer partner logos use /assets/partners', () => {
    const s = read('src/components/SiteFooter.vue');
    expect(s.includes('src="/assets/partners/')).toBe(true);
    expect(s.includes('src="/images/hz-logo.png"')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行 tests，确认失败**

Run:
```bash
bun test frontend/src/assets/__tests__/assetPaths.test.ts
```

Expected: FAIL（因为还没改引用）。

- [ ] **Step 3: 复制品牌/UI/合作方资源到新目录**

Run:
```bash
mkdir -p frontend/public/assets/brand/fontlogo frontend/public/assets/ui/navigation frontend/public/assets/ui/download frontend/public/assets/partners
cp -a frontend/public/images/fontlogo/. frontend/public/assets/brand/fontlogo/
cp -a frontend/public/images/navigation/. frontend/public/assets/ui/navigation/
cp -a frontend/public/images/download/. frontend/public/assets/ui/download/
cp -a frontend/public/images/aiwb-icon.webp frontend/public/assets/brand/aiwb-icon.webp
cp -a frontend/public/images/hz-logo.png frontend/public/assets/partners/hz-logo.png
```

Note: `aiwb-icon.webp` 若不存在则先选择存在的 icon 文件名并保持一致，然后在 Step 4 的代码里同步。

- [ ] **Step 4: 更新 BrandMark.vue 引用到 /assets/brand**

Update `frontend/src/components/BrandMark.vue` to use:
```vue
<img src="/assets/brand/aiwb-icon.webp" ... />
<source ... srcset="/assets/brand/fontlogo/aiwb-font-white.webp">
<img ... src="/assets/brand/fontlogo/aiwb-font-dark.webp" ...>
```

- [ ] **Step 5: 更新 SiteFooter.vue 的伙伴 logo 引用到 /assets/partners**

Update `frontend/src/components/SiteFooter.vue`:
```vue
src="/assets/partners/hz-logo.png"
```

- [ ] **Step 6: 更新 NavBar.vue 中导航/下载等 SVG 引用（如果有）到 /assets/ui**

如果 NavBar 仅用 lucide icon，则此步只确认无需变更；若存在硬编码 `/images/navigation` 或 `/images/download`，则改为 `/assets/ui/...`。

- [ ] **Step 7: 再次运行 tests，确认通过**

Run:
```bash
bun test frontend/src/assets/__tests__/assetPaths.test.ts
```

Expected: PASS

---

### Task 3: 定义 project-key 规则并写单元测试（后端）

**Files:**
- Create: `backend/src/domain/projectKey.ts`
- Test: `backend/src/domain/projectKey.test.ts`

- [ ] **Step 1: 写 failing test（project-key 生成规则）**

Create `backend/src/domain/projectKey.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { projectKeyFrom } from './projectKey';

describe('projectKeyFrom', () => {
  test('prefers slug when present', () => {
    expect(projectKeyFrom({ slug: 'My-Slug', name: 'X', github_url: '' })).toBe('my-slug');
  });

  test('falls back to github owner/repo when possible', () => {
    expect(projectKeyFrom({ name: 'X', github_url: 'https://github.com/Owner/Repo' })).toBe('owner-repo');
  });

  test('falls back to name', () => {
    expect(projectKeyFrom({ name: 'Hello World', github_url: '' })).toBe('hello-world');
  });
});
```

- [ ] **Step 2: Run test，确认失败（因为函数不存在）**

Run:
```bash
bun test backend/src/domain/projectKey.test.ts
```

Expected: FAIL

- [ ] **Step 3: 写最小实现**

Create `backend/src/domain/projectKey.ts`:
```ts
const slugify = (input: string) => {
  const lowered = input.trim().toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return replaced || 'project';
};

const tryGithubOwnerRepo = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}-${parts[1]}`.toLowerCase();
  } catch {
    return null;
  }
};

export const projectKeyFrom = (p: { slug?: string; name?: string; github_url?: string }) => {
  if (p.slug?.trim()) return slugify(p.slug);
  const gh = p.github_url ? tryGithubOwnerRepo(p.github_url) : null;
  if (gh) return slugify(gh);
  return slugify(p.name ?? '');
};
```

- [ ] **Step 4: Run test，确认通过**

Run:
```bash
bun test backend/src/domain/projectKey.test.ts
```

Expected: PASS

---

### Task 4: 编写迁移脚本：把项目资源复制到 `assets/projects/<project-key>/...` 并更新 data.json

**Files:**
- Create: `backend/src/scripts/migrate-project-assets.ts`
- Test: `backend/src/scripts/migrate-project-assets.test.ts`
- Modify: `backend/src/data.json`

- [ ] **Step 1: 写 failing test（对小样本 JSON 做 rewrite）**

Create `backend/src/scripts/migrate-project-assets.test.ts`:
```ts
import { describe, expect, test } from 'bun:test';
import { rewriteProjectAssets } from './migrate-project-assets';

describe('rewriteProjectAssets', () => {
  test('rewrites local_images to assets/projects/<key>', () => {
    const input = {
      categories: [
        { id: 'c1', name: 'x', description: 'x', projects: [
          { name: 'TimerIn', github_url: 'https://github.com/a/b', icon: '/local_images/icons/aaa.webp', banner: '/local_images/banners/bbb.webp', avatar: '/local_images/avatars/ccc.webp' }
        ] }
      ]
    };
    const out = rewriteProjectAssets(input as any);
    const p = out.categories[0].projects[0] as any;
    expect(p.icon).toMatch(/^\/assets\/projects\/a-b\//);
    expect(p.banner).toMatch(/^\/assets\/projects\/a-b\//);
    expect(p.avatar).toMatch(/^\/assets\/projects\/a-b\//);
  });
});
```

- [ ] **Step 2: Run test，确认失败**

Run:
```bash
bun test backend/src/scripts/migrate-project-assets.test.ts
```

Expected: FAIL

- [ ] **Step 3: 写脚本实现（rewrite + 复制文件）**

Create `backend/src/scripts/migrate-project-assets.ts`:
```ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { projectKeyFrom } from '../domain/projectKey';

type Project = any;
type Catalog = { categories: Array<{ projects: Project[] }> };

const repoRoot = path.join(import.meta.dir, '../../..');
const dataPath = path.join(repoRoot, 'backend/src/data.json');
const publicDir = path.join(repoRoot, 'frontend/public');
const assetsProjectsDir = path.join(publicDir, 'assets/projects');

const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });

const extFromPath = (p: string) => {
  const ext = path.extname(p);
  return ext && ext.length <= 6 ? ext : '.png';
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

export const rewriteProjectAssets = (catalog: Catalog) => {
  const out = structuredClone(catalog);
  for (const c of out.categories) {
    for (const p of c.projects) {
      const key = projectKeyFrom(p);
      const base = `/assets/projects/${key}`;
      const rewriteOne = (field: 'icon' | 'banner' | 'avatar') => {
        const v = p[field];
        if (!v || typeof v !== 'string') return;
        const ext = v.startsWith('http') ? extFromPath(new URL(v).pathname) : extFromPath(v);
        p[field] = `${base}/${field}${ext}`;
      };
      rewriteOne('icon');
      rewriteOne('banner');
      rewriteOne('avatar');
    }
  }
  return out;
};

const toAbsFromPublicPath = (publicPath: string) => path.join(publicDir, publicPath.replace(/^\//, ''));

const applyFileOps = async (before: Catalog, after: Catalog) => {
  const flat = (cat: Catalog) =>
    cat.categories.flatMap((c: any) => c.projects.map((p: any) => ({ p })));

  const beforeProjects = flat(before);
  const afterProjects = flat(after);

  for (let i = 0; i < afterProjects.length; i++) {
    const bp = beforeProjects[i].p;
    const ap = afterProjects[i].p;
    for (const field of ['icon', 'banner', 'avatar'] as const) {
      const oldV = bp[field];
      const newV = ap[field];
      if (!oldV || !newV) continue;
      if (typeof oldV !== 'string' || typeof newV !== 'string') continue;
      if (!newV.startsWith('/assets/projects/')) continue;
      const destAbs = toAbsFromPublicPath(newV);
      if (oldV.startsWith('/')) {
        const srcAbs = toAbsFromPublicPath(oldV);
        if (fs.existsSync(srcAbs)) copyLocal(srcAbs, destAbs);
      } else if (oldV.startsWith('http')) {
        await downloadTo(oldV, destAbs);
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
```

- [ ] **Step 4: Run test，确认通过**

Run:
```bash
bun test backend/src/scripts/migrate-project-assets.test.ts
```

Expected: PASS

- [ ] **Step 5: 运行迁移脚本（会更新 data.json 并复制文件）**

Run:
```bash
bun run backend/src/scripts/migrate-project-assets.ts
```

Expected: 输出 `project asset migration done`，并在 `frontend/public/assets/projects/` 产生多个项目目录。

- [ ] **Step 6: 断言 data.json 已 canonical 化**

Run:
```bash
grep -R "\"icon\": \"/assets/projects/" -n backend/src/data.json | head
grep -R "\"banner\": \"/assets/projects/" -n backend/src/data.json | head
```

Expected: 能看到大量 `/assets/projects/...` 路径。

---

### Task 5: 修复下载脚本 `download_images.py` 的硬编码路径并输出到 canonical

**Files:**
- Modify: `backend/src/download_images.py`

- [ ] **Step 1: 写 failing check（脚本运行路径不应包含旧仓库 hardcode）**

Run:
```bash
grep -n "/workspace/awesome-iwb" backend/src/download_images.py
```

Expected: 当前应能匹配到（fail baseline）。

- [ ] **Step 2: 修改脚本为基于 repoRoot 的相对路径，并输出到 `assets/projects/<project-key>`**

实现要点：
- `DATA_FILE` 指向 `AwesomeIWBWeb/backend/src/data.json`
- `PUBLIC_DIR` 指向 `AwesomeIWBWeb/frontend/public`
- 使用与 `projectKeyFrom` 一致的规则（可直接在 python 中实现同等 slugify 与 github owner/repo 解析）
- 对每个项目的 icon/banner/avatar：
  - 若是 http(s) URL：下载并保存为 `<type>.<ext>`
  - 若已是本地 `/assets/projects/...`：跳过

- [ ] **Step 3: 运行脚本做幂等验证**

Run:
```bash
python3 backend/src/download_images.py
python3 backend/src/download_images.py
```

Expected: 第二次运行不应重复下载同一资源（文件已存在则跳过）。

---

### Task 6: 全量验证（前后端）

**Files:**
- N/A (verification only)

- [ ] **Step 1: 前端单测**

Run:
```bash
cd frontend && bun test
```

Expected: PASS

- [ ] **Step 2: 后端单测**

Run:
```bash
cd backend && bun test
```

Expected: PASS

- [ ] **Step 3: 启动 dev 并检查关键页面加载**

Run:
```bash
cd backend && bun run dev
```
and in another terminal:
```bash
cd frontend && bun run dev -- --host 0.0.0.0 --port 5173
```

Check:
- `/` 首页项目卡片 icon/banner 正常
- `/project/<name>` 详情页 icon/banner 正常
- footer/navbar 的 brand/partners 正常

- [ ] **Step 4: 运行资源检查脚本（应通过）**

Run:
```bash
node scripts/check-assets.js
```

Expected: PASS（若 FAIL，说明仍有项目资源遗留在旧目录根层）。

