import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, 'ops', 'check-assets.js');
const result = spawnSync(process.execPath, [target], { stdio: 'inherit' });
process.exit(result.status ?? 1);

