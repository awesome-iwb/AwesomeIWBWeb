const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pass = process.env.SSH_PASS;
if (!pass) {
  console.error('SSH_PASS required');
  process.exit(1);
}

const ROOT = path.join('D:', 'github', 'AwesomeIWBWeb');
const DIST = path.join(ROOT, 'frontend', 'dist');
const ARTIFACTS = path.join(ROOT, '_deploy_artifacts');
const DIST_TAR = path.join(ARTIFACTS, 'dist-audit-ux.tar.gz');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Missing frontend/dist — run frontend build first');
  process.exit(1);
}

fs.mkdirSync(ARTIFACTS, { recursive: true });
execSync(`tar -czf "${DIST_TAR}" -C "${DIST}" .`, { stdio: 'inherit' });

function exec(conn, cmd, label, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 120)));
    const timer = setTimeout(() => reject(new Error('timeout: ' + label)), timeoutMs);
    conn.exec(cmd, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve(code ?? 0);
      });
    });
  });
}

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(local);
    const ws = sftp.createWriteStream(remote);
    ws.on('close', resolve);
    ws.on('error', reject);
    rs.pipe(ws);
  });
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    const backup = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR"',
      'tar -czf "$BACKUP_DIR/dist-backup.tar.gz" -C /var/www/awesomeiwb dist 2>/dev/null || true',
      'echo "$TS|$BACKUP_DIR" | tee /opt/awesomeiwb/backups/LATEST_AUDIT_UX.txt',
    ].join('\n');
    const backupOut = await exec(conn, backup, 'Create dist backup');
    if (backupOut !== 0) throw new Error('backup failed');

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    await upload(sf, DIST_TAR, '/tmp/dist-audit-ux.tar.gz');
    console.log('Uploaded frontend dist');

    const deploy = [
      'set -e',
      'WWW=/var/www/awesomeiwb/dist',
      'if [ ! -d "$WWW" ]; then echo "Missing $WWW"; exit 1; fi',
      'rm -rf "$WWW"/*',
      'tar -xzf /tmp/dist-audit-ux.tar.gz -C "$WWW"',
      'HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/health)',
      'echo "health=$HTTP"',
      'test "$HTTP" = "200"',
      'ls "$WWW"/assets/AuditView-*.js | head -1',
      'rm -f /tmp/dist-audit-ux.tar.gz',
    ].join('\n');
    const code = await exec(conn, deploy, 'Deploy dist + health check', 120000);
    if (code !== 0) process.exit(code);
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 600000 });
