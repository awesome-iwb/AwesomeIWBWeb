const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const LOCAL_ROOT = 'D:\\github\\AwesomeIWBWeb';
const REMOTE_ROOT = '/opt/awesomeiwb';

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

const frontendSrcFiles = walkDir(path.join(LOCAL_ROOT, 'frontend', 'src'), 'src');
const frontendOtherFiles = ['package.json', 'bun.lock', 'tsconfig.json', 'index.html', 'vite.config.ts'];
const allFrontendFiles = frontendSrcFiles.map(f => `frontend/${f}`).concat(frontendOtherFiles.map(f => `frontend/${f}`));

console.log(`Total frontend files to upload: ${allFrontendFiles.length}`);

const conn = new Client();

function execCmd(cmd, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${label || cmd.substring(0, 100)}`);
    conn.exec(cmd, (err, stream) => {
      if (err) { reject(err); return; }
      let stdout = '', stderr = '';
      stream.on('data', (data) => { stdout += data.toString(); process.stdout.write(data.toString()); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); process.stdout.write('[STDERR] ' + data.toString()); });
      stream.on('close', (code) => { resolve({ stdout, stderr, code }); });
    });
  });
}

function ensureRemoteDir(sftp, remotePath) {
  return new Promise((resolve) => {
    sftp.mkdir(remotePath, (err) => {
      if (err && err.code !== 4) {
        const parent = remotePath.substring(0, remotePath.lastIndexOf('/'));
        if (parent) {
          ensureRemoteDir(sftp, parent).then(() => {
            sftp.mkdir(remotePath, () => resolve());
          });
        } else resolve();
      } else resolve();
    });
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.on('close', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
    readStream.pipe(writeStream);
  });
}

conn.on('ready', async () => {
  console.log('SSH connected!');

  try {
    console.log('\n=== Step 1: Upload ALL frontend source files ===');
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });

    let idx = 0;
    const total = allFrontendFiles.length;
    for (const f of allFrontendFiles) {
      const localPath = path.join(LOCAL_ROOT, ...f.split('/'));
      const remotePath = `${REMOTE_ROOT}/${f}`;
      if (!fs.existsSync(localPath)) {
        idx++;
        continue;
      }
      try {
        const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
        await ensureRemoteDir(sftp, remoteDir);
        await uploadFile(sftp, localPath, remotePath);
        idx++;
        if (idx % 30 === 0 || idx === total) {
          console.log(`  Progress: ${idx}/${total}`);
        }
      } catch (e) {
        console.error(`  FAIL ${f}: ${e.message}`);
        idx++;
      }
    }
    console.log(`Upload complete: ${idx}/${total} files`);

    console.log('\n=== Step 2: Install dependencies ===');
    await execCmd(`cd ${REMOTE_ROOT}/frontend && bun install 2>&1 | tail -3`, 'Install deps');

    console.log('\n=== Step 3: Build frontend ===');
    await execCmd(`cd ${REMOTE_ROOT}/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -20`, 'Build frontend');

    console.log('\n=== Step 4: Deploy frontend dist ===');
    await execCmd(`rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r ${REMOTE_ROOT}/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Frontend deployed!"`, 'Deploy frontend');

    console.log('\n=== Step 5: Verify ===');
    await execCmd(`echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`);
    await execCmd(`echo -n "Categories: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/categories`);
    await execCmd(`echo -n "Today: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/today`);

    console.log('\n\n=== DEPLOYMENT COMPLETE ===');
  } catch (e) {
    console.error('Deployment error:', e.message);
  }

  conn.end();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
