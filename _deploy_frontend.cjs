const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';
const LOCAL_DIST = 'd:\\github\\AwesomeIWBWeb\\frontend\\dist';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => (stdout += d.toString()));
      stream.stderr.on('data', (d) => (stderr += d.toString()));
      stream.on('close', (code) => resolve({ code, stdout, stderr, cmd }));
    });
  });
}

function put(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(localPath);
    const ws = sftp.createWriteStream(remotePath);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('close', resolve);
    rs.pipe(ws);
  });
}

async function main() {
  const conn = new Client();
  console.log('Connecting...');
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST, port: 22, username: USER, password: PASS,
      readyTimeout: 60000, keepaliveInterval: 10000,
    });
  });
  console.log('Connected!');

  try {
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
    });

    // Create tar
    const tarPath = path.join(LOCAL_DIST, '..', '_dist.tar.gz');
    console.log('Creating tar...');
    execSync(`tar -czf "${tarPath}" -C "${LOCAL_DIST}" .`, { stdio: 'pipe' });

    // Upload
    console.log('Uploading...');
    await put(sftp, tarPath, '/tmp/_dist.tar.gz');

    // Extract
    console.log('Extracting...');
    await exec(conn, 'cd /var/www/awesomeiwb/dist && tar -xzf /tmp/_dist.tar.gz --overwrite');
    await exec(conn, 'rm -f /tmp/_dist.tar.gz');

    // Sync to other path
    console.log('Syncing...');
    await exec(conn, 'rsync -a --delete /var/www/awesomeiwb/dist/ /www/sites/aiwb.smart-teach.cn/dist/');

    // Clean up
    try { fs.unlinkSync(tarPath); } catch (e) {}

    // Also rebuild backend Docker image with updated migration
    console.log('Rebuilding backend...');
    const buildResult = await exec(conn, 'cd /opt/awesomeiwb/deploy && docker compose build backend 2>&1');
    console.log(buildResult.stdout.substring(buildResult.stdout.length - 500));

    console.log('Restarting backend...');
    await exec(conn, 'cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1');

    // Wait
    await new Promise(r => setTimeout(r, 8000));

    // Verify
    const status = await exec(conn, 'docker ps --filter "name=awesomeiwb-backend" --format "{{.Status}}" 2>&1');
    console.log('Container status:', status.stdout.trim());

    const apiTest = await exec(conn, 'curl -s http://127.0.0.1:8081/api/projects 2>&1 | head -c 100');
    console.log('API test:', apiTest.stdout.substring(0, 100));

    console.log('\nDEPLOY_COMPLETE');
  } finally {
    conn.end();
  }
}

main().catch(console.error);
