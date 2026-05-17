const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const LOCAL_ROOT = 'D:\\github\\AwesomeIWBWeb';
const REMOTE_ROOT = '/opt/awesomeiwb';
const conn = new Client();

function execCmd(cmd, label) {
  return new Promise((resolve) => {
    console.log(`\n>>> ${label || cmd.substring(0, 100)}`);
    conn.exec(cmd, (err, stream) => {
      if (err) { console.error(err); resolve(''); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
      stream.on('close', () => resolve(''));
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
    console.log('\n=== Step 1: Stop backend container ===');
    await execCmd('cd /opt/awesomeiwb/deploy && docker compose stop backend 2>&1', 'Stop backend');

    console.log('\n=== Step 2: Upload fixed migration file ===');
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });
    await uploadFile(sftp, path.join(LOCAL_ROOT, 'backend/migrations/0021_project_members.sql'), `${REMOTE_ROOT}/backend/migrations/0021_project_members.sql`);
    console.log('  ✓ 0021_project_members.sql uploaded');

    console.log('\n=== Step 3: Rebuild Docker backend ===');
    await execCmd('cd /opt/awesomeiwb/deploy && docker compose build backend 2>&1 | tail -10', 'Rebuild backend', 120000);

    console.log('\n=== Step 4: Start backend container ===');
    await execCmd('cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1', 'Start backend');
    await new Promise(r => setTimeout(r, 15000));

    console.log('\n=== Step 5: Check status ===');
    await execCmd('docker ps --filter name=awesomeiwb-backend --format "{{.Names}}\t{{.Status}}"', 'Check status');
    await execCmd('docker logs awesomeiwb-backend --tail 20 2>&1', 'Check logs');

    console.log('\n=== Step 6: Check applied migrations ===');
    await execCmd('docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT version FROM schema_migrations WHERE version LIKE \'002%\' ORDER BY version;" 2>&1', 'Check migrations');

    console.log('\n=== Step 7: Verify API ===');
    await execCmd('echo -n "API /api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects');
    await execCmd('echo -n "API /api/auth/login: " && curl -sk https://aiwb.smart-teach.cn/api/auth/login 2>&1 | head -c 200');

    console.log('\n\n=== DONE ===');
  } catch (e) {
    console.error('Error:', e.message);
  }

  conn.end();
});

conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
