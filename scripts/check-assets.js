import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const dataPath = path.join(repoRoot, 'backend', 'src', 'data.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const bad = [];
for (const cat of data.categories ?? []) {
  for (const proj of cat.projects ?? []) {
    for (const field of ['icon', 'banner', 'avatar']) {
      const v = proj[field];
      if (!v || typeof v !== 'string') continue;
      if (v.startsWith('/assets/projects/')) continue;
      bad.push({ project: proj.name, field, value: v });
    }
  }
}

if (bad.length) {
  for (const b of bad) {
    console.error(`${b.project}: ${b.field} -> ${b.value}`);
  }
  process.exit(1);
}

console.log('asset refs check: ok');

