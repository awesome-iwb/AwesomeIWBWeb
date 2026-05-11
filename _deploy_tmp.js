const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

function execCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    log(`EXEC: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });
      stream.on('close', (code) => {
        log(`EXIT CODE: ${code}`);
        resolve({ stdout, stderr, code });
      });
    });
  });
}

function getSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

function sftpMkdir(sftp, remotePath) {
  return new Promise((resolve) => {
    sftp.mkdir(remotePath, (err) => {
      resolve(!err);
    });
  });
}

function sftpUploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(localPath);
    const ws = sftp.createWriteStream(remotePath);
    ws.on('close', () => resolve());
    ws.on('error', reject);
    rs.on('error', reject);
    rs.pipe(ws);
  });
}

function sftpExists(sftp, remotePath) {
  return new Promise((resolve) => {
    sftp.stat(remotePath, (err) => {
      resolve(!err);
    });
  });
}

async function ensureRemoteDir(sftp, remotePath) {
  const parts = remotePath.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += '/' + part;
    const exists = await sftpExists(sftp, current);
    if (!exists) {
      await sftpMkdir(sftp, current);
    }
  }
}

async function uploadDirRecursive(sftp, localDir, remoteDir, baseLocalDir) {
  if (!baseLocalDir) baseLocalDir = localDir;
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  let fileCount = 0;

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = remoteDir + '/' + entry.name;

    if (entry.isDirectory()) {
      await ensureRemoteDir(sftp, remotePath);
      const count = await uploadDirRecursive(sftp, localPath, remotePath, baseLocalDir);
      fileCount += count;
    } else if (entry.isFile()) {
      await sftpUploadFile(sftp, localPath, remotePath);
      fileCount++;
      if (fileCount % 50 === 0) {
        log(`  Uploaded ${fileCount} files so far...`);
      }
    }
  }
  return fileCount;
}

async function uploadSingleFile(sftp, localPath, remotePath) {
  const remoteDir = path.dirname(remotePath).replace(/\\/g, '/');
  await ensureRemoteDir(sftp, remoteDir);
  await sftpUploadFile(sftp, localPath, remotePath);
  log(`  Uploaded: ${localPath} -> ${remotePath}`);
}

async function main() {
  log('=== Connecting to server ===');
  const conn = await connect();
  log('Connected!');

  try {
    const sftp = await getSftp(conn);
    log('SFTP session opened');

    // ===== STEP 1: Upload frontend dist =====
    log('\n=== STEP 1: Upload frontend dist ===');

    log('Clearing old dist...');
    await execCmd(conn, 'rm -rf /var/www/awesomeiwb/dist/*');

    log('Uploading frontend dist...');
    const frontendDistLocal = path.resolve(__dirname, 'frontend/dist');
    const frontendDistRemote = '/var/www/awesomeiwb/dist';
    await ensureRemoteDir(sftp, frontendDistRemote);
    const frontendCount = await uploadDirRecursive(sftp, frontendDistLocal, frontendDistRemote);
    log(`Frontend dist uploaded: ${frontendCount} files`);

    log('Setting permissions...');
    await execCmd(conn, 'chown -R www-data:www-data /var/www/awesomeiwb/dist');

    // ===== STEP 2: Sync backend source code =====
    log('\n=== STEP 2: Sync backend source code ===');

    log('Clearing old backend src...');
    await execCmd(conn, 'rm -rf /opt/awesomeiwb/backend/src/*');

    log('Uploading backend src...');
    const backendSrcLocal = path.resolve(__dirname, 'backend/src');
    const backendSrcRemote = '/opt/awesomeiwb/backend/src';
    await ensureRemoteDir(sftp, backendSrcRemote);
    const backendCount = await uploadDirRecursive(sftp, backendSrcLocal, backendSrcRemote);
    log(`Backend src uploaded: ${backendCount} files`);

    log('Uploading backend package.json...');
    await uploadSingleFile(sftp, path.resolve(__dirname, 'backend/package.json'), '/opt/awesomeiwb/backend/package.json');

    log('Uploading backend bun.lock...');
    await uploadSingleFile(sftp, path.resolve(__dirname, 'backend/bun.lock'), '/opt/awesomeiwb/backend/bun.lock');

    // ===== STEP 3: Rebuild and restart backend =====
    log('\n=== STEP 3: Rebuild and restart backend ===');

    log('Building backend container (no cache)...');
    const buildResult = await execCmd(conn, 'cd /opt/awesomeiwb/deploy && docker compose build backend --no-cache');
    log(`Build completed with exit code ${buildResult.code}`);

    log('Restarting backend container...');
    const upResult = await execCmd(conn, 'cd /opt/awesomeiwb/deploy && docker compose up -d backend --force-recreate');
    log(`Restart completed with exit code ${upResult.code}`);

    log('Waiting 10 seconds for container to start...');
    await new Promise((r) => setTimeout(r, 10000));

    log('Checking container status...');
    await execCmd(conn, 'docker ps --filter name=awesomeiwb-backend --format "{{.Names}} {{.Status}}"');

    // ===== STEP 4: Verify =====
    log('\n=== STEP 4: Verify ===');

    log('Test frontend...');
    await execCmd(conn, 'curl -s -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8080/');

    log('Test API /api/projects/ICC-CE...');
    await execCmd(conn, 'curl -s -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8080/api/projects/ICC-CE');

    log('Test /api/auth/me...');
    await execCmd(conn, 'curl -s -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8081/api/auth/me');

    log('Check uploads directory...');
    const lsResult = await execCmd(conn, 'ls /opt/awesomeiwb/backend/runtime/uploads/ | head -3');

    log('Test uploads endpoint...');
    await execCmd(conn, 'FIRST_UPLOAD=$(ls /opt/awesomeiwb/backend/runtime/uploads/ | head -1) && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/api/uploads/$FIRST_UPLOAD');

    log('Check backend health...');
    await execCmd(conn, "docker inspect awesomeiwb-backend --format='{{.State.Health.Status}}'");

    log('Backend logs (last 5 lines)...');
    await execCmd(conn, 'docker logs awesomeiwb-backend --tail 5');

    log('\n=== DEPLOYMENT COMPLETE ===');
  } catch (err) {
    log('ERROR:', err.message);
    console.error(err);
  } finally {
    conn.end();
    log('Connection closed.');
  }
}

main();
