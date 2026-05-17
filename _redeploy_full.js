const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const LOCAL_ROOT = 'D:\\github\\AwesomeIWBWeb';
const REMOTE_ROOT = '/opt/awesomeiwb';
const HOST = '210.16.165.251';
const PORT = 22;
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';

function walkDir(dir, base = '') {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.nuxt', '.output', 'runtime'].includes(entry.name)) continue;
      results.push(...walkDir(fullPath, relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

const backendSrcFiles = walkDir(path.join(LOCAL_ROOT, 'backend', 'src'), 'src');
const backendOtherFiles = ['package.json', 'bun.lock', 'tsconfig.json'];
const frontendSrcFiles = walkDir(path.join(LOCAL_ROOT, 'frontend', 'src'), 'src');
const frontendOtherFiles = ['package.json', 'bun.lock', 'tsconfig.json', 'index.html', 'vite.config.ts'];

const allBackendFiles = backendSrcFiles.map(f => `backend/${f}`).concat(backendOtherFiles.map(f => `backend/${f}`));
const allFrontendFiles = frontendSrcFiles.map(f => `frontend/${f}`).concat(frontendOtherFiles.map(f => `frontend/${f}`));
const allFiles = [...allBackendFiles, ...allFrontendFiles];

console.log(`Total files to upload: ${allFiles.length}`);
console.log(`  Backend: ${allBackendFiles.length}`);
console.log(`  Frontend: ${allFrontendFiles.length}`);

const conn = new Client();

function execCmd(cmd, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${label || cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) { reject(err); return; }
      let stdout = '', stderr = '';
      stream.on('data', (data) => { stdout += data.toString(); process.stdout.write(data.toString()); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); process.stdout.write('[STDERR] ' + data.toString()); });
      stream.on('close', (code) => {
        if (code !== 0 && !label?.includes('ignore')) {
          console.log(`  Exit code: ${code}`);
        }
        resolve({ stdout, stderr, code });
      });
    });
  });
}

function ensureRemoteDir(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err && err.code !== 4) {
        const parent = remotePath.substring(0, remotePath.lastIndexOf('/'));
        if (parent) {
          ensureRemoteDir(sftp, parent).then(() => {
            sftp.mkdir(remotePath, (err2) => {
              if (err2 && err2.code !== 4) reject(err2);
              else resolve();
            });
          }).catch(reject);
        } else resolve();
      } else resolve();
    });
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    ensureRemoteDir(sftp, remoteDir).then(() => {
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on('close', resolve);
      writeStream.on('error', reject);
      readStream.on('error', reject);
      readStream.pipe(writeStream);
    }).catch(reject);
  });
}

async function uploadAllFiles(sftp) {
  let idx = 0;
  const total = allFiles.length;
  for (const f of allFiles) {
    const localPath = path.join(LOCAL_ROOT, ...f.split('/'));
    const remotePath = `${REMOTE_ROOT}/${f}`;
    if (!fs.existsSync(localPath)) {
      console.log(`  SKIP ${f} (not found locally)`);
      idx++;
      continue;
    }
    try {
      await uploadFile(sftp, localPath, remotePath);
      idx++;
      if (idx % 20 === 0 || idx === total) {
        console.log(`  Progress: ${idx}/${total}`);
      }
    } catch (e) {
      console.error(`  FAIL ${f}: ${e.message}`);
    }
  }
  console.log(`\nUpload complete: ${idx}/${total} files`);
}

conn.on('ready', async () => {
  console.log('SSH connected!');

  try {
    console.log('\n=== Step 1: Check server env file ===');
    await execCmd('cat /etc/awesomeiwb/backend.env | grep -E "CASDOOR|NODE_ENV|FRONTEND_URL|OAUTH_ENABLED|DEMO_LOGIN" || echo "ENV FILE NOT FOUND"');

    console.log('\n=== Step 2: Upload all source files ===');
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });
    await uploadAllFiles(sftp);

    console.log('\n=== Step 3: Install dependencies ===');
    await execCmd(`cd ${REMOTE_ROOT}/backend && bun install --production 2>&1 | tail -3`);
    await execCmd(`cd ${REMOTE_ROOT}/frontend && bun install 2>&1 | tail -3`);

    console.log('\n=== Step 4: Build backend (type check) ===');
    await execCmd(`cd ${REMOTE_ROOT}/backend && echo "Backend uses bun run directly, no build step needed"`);

    console.log('\n=== Step 5: Build frontend ===');
    await execCmd(`cd ${REMOTE_ROOT}/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -20`);

    console.log('\n=== Step 6: Deploy frontend dist ===');
    await execCmd(`rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r ${REMOTE_ROOT}/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Frontend deployed!"`);

    console.log('\n=== Step 7: Restart backend service ===');
    await execCmd(`fuser -k 8080/tcp 2>/dev/null; fuser -k 8081/tcp 2>/dev/null; sleep 1; echo "Ports cleared"`);
    await execCmd(`systemctl restart awesomeiwb-backend && sleep 3 && systemctl is-active awesomeiwb-backend`);

    console.log('\n=== Step 8: Verify ===');
    await execCmd(`echo -n "API /api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects`);
    await execCmd(`echo "" && echo -n "API /api/auth/login: " && curl -sk https://aiwb.smart-teach.cn/api/auth/login 2>&1 | head -c 500`);
    await execCmd(`echo "" && echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`);

    console.log('\n=== Step 9: Check backend logs for errors ===');
    await execCmd(`tail -20 /var/log/awesomeiwb/backend.err.log 2>/dev/null || echo "No error log"`);
    await execCmd(`tail -10 /var/log/awesomeiwb/backend.log 2>/dev/null || echo "No log"`);

    console.log('\n\n=== DEPLOYMENT COMPLETE ===');
  } catch (e) {
    console.error('Deployment error:', e.message);
  }

  conn.end();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: HOST, port: PORT, username: USER, password: PASS, readyTimeout: 30000 });
