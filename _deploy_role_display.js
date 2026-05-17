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
const DIST_TAR = path.join(ARTIFACTS, 'dist-role-display.tar.gz');
const BACKEND_TAR = path.join(ARTIFACTS, 'backend-role-display.tar.gz');

const BACKEND_FILES = [
  'backend/src/domain/displayRole.ts',
  'backend/src/domain/displayRole.test.ts',
  'backend/src/services/users.ts',
];

const FRONTEND_FILES = [
  'frontend/src/views/admin/UsersView.vue',
  'frontend/src/views/MeView.vue',
  'frontend/src/views/UserProfileView.vue',
  'frontend/src/utils/displayRole.ts',
];

fs.mkdirSync(ARTIFACTS, { recursive: true });
execSync(`tar -czf "${DIST_TAR}" -C "${DIST}" .`, { stdio: 'inherit' });

const backendStaging = path.join(ARTIFACTS, 'backend-role-staging');
fs.rmSync(backendStaging, { recursive: true, force: true });
for (const rel of BACKEND_FILES) {
  const dest = path.join(backendStaging, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dest);
}
execSync(`tar -czf "${BACKEND_TAR}" -C "${backendStaging}" backend`, { stdio: 'inherit' });

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
    await exec(
      conn,
      [
        'echo "=== dist path probe ==="',
        'for d in /var/www/awesomeiwb/dist /opt/1panel/www/sites/aiwb.smart-teach.cn/index/dist; do',
        '  if [ -d "$d" ]; then echo "FOUND $d"; ls -la "$d/index.html" 2>/dev/null || echo "  (no index.html)"; fi',
        'done',
        'echo "=== nginx root (if any) ==="',
        'grep -r "root " /etc/nginx 2>/dev/null | grep -i awesome | head -5 || true',
      ].join('\n'),
      'Probe dist paths',
    );

    const backup = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR"',
      'tar -czf "$BACKUP_DIR/dist-backup.tar.gz" -C /var/www/awesomeiwb dist 2>/dev/null || true',
      'tar -czf "$BACKUP_DIR/backend-src-backup.tar.gz" -C /opt/awesomeiwb backend/src/domain backend/src/services/users.ts 2>/dev/null || true',
      'echo "$TS|$BACKUP_DIR" | tee /opt/awesomeiwb/backups/LATEST_ROLE_DISPLAY.txt',
    ].join('\n');
    const backupOut = await exec(conn, backup, 'Create backup');
    if (backupOut !== 0) throw new Error('backup failed');

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    await upload(sf, DIST_TAR, '/tmp/dist-role-display.tar.gz');
    await upload(sf, BACKEND_TAR, '/tmp/backend-role-display.tar.gz');
    console.log('Uploaded frontend dist + backend src bundle');

    const deploy = [
      'set -e',
      'WWW=/var/www/awesomeiwb/dist',
      'if [ ! -d "$WWW" ]; then echo "Missing $WWW"; exit 1; fi',
      'rm -rf "$WWW"/*',
      'tar -xzf /tmp/dist-role-display.tar.gz -C "$WWW"',
      'tar -xzf /tmp/backend-role-display.tar.gz -C /opt/awesomeiwb',
      'cd /opt/awesomeiwb/deploy',
      'docker compose build backend',
      'docker compose up -d backend',
      'sleep 4',
      "curl -sS -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health",
      'echo',
      'grep -l role_label dist/assets/UsersView-*.js 2>/dev/null | head -1 || ls "$WWW"/assets/UsersView-*.js | head -1',
      'rm -f /tmp/dist-role-display.tar.gz /tmp/backend-role-display.tar.gz',
    ].join('\n');
    const code = await exec(conn, deploy, 'Deploy + docker rebuild', 900000);
    if (code !== 0) process.exit(code);
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 600000 });
