const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const LOCAL_ROOT = 'D:\\github\\AwesomeIWBWeb';
const REMOTE_ROOT = '/opt/awesomeiwb';

const filesToUpload = [
  'frontend/src/components/MobileTabBar.vue',
  'frontend/src/components/NavBar.vue',
  'frontend/src/views/CategoriesView.vue',
  'frontend/src/views/HomeView.vue',
  'frontend/src/App.vue',
  'frontend/src/router/index.ts',
];

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
    console.log('\n=== Step 1: Upload files ===');
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });

    for (const f of filesToUpload) {
      const localPath = path.join(LOCAL_ROOT, ...f.split('/'));
      const remotePath = `${REMOTE_ROOT}/${f}`;
      console.log(`  Uploading ${f}...`);
      await uploadFile(sftp, localPath, remotePath);
      console.log(`  ✓ ${f}`);
    }

    console.log('\n=== Step 2: Build frontend ===');
    await execCmd(`cd ${REMOTE_ROOT}/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -15`, 'Build frontend');

    console.log('\n=== Step 3: Deploy frontend dist ===');
    await execCmd(`rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r ${REMOTE_ROOT}/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Frontend deployed!"`, 'Deploy frontend');

    console.log('\n=== Step 4: Verify ===');
    await execCmd(`echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`);
    await execCmd(`echo -n "Categories: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/categories`);

    console.log('\n\n=== DEPLOYMENT COMPLETE ===');
  } catch (e) {
    console.error('Deployment error:', e.message);
  }

  conn.end();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
