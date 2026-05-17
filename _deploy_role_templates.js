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
const WWW = '/var/www/awesomeiwb/dist';
const PANEL_DIST = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';

const UPLOAD_FILES = [
  'backend/src/index.ts',
  'frontend/src/views/admin/UsersView.vue',
  'frontend/src/components/admin/CapabilityEditor.vue',
];

function exec(conn, cmd, label, timeoutMs = 900000) {
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
      'tar -czf "$BACKUP_DIR/dist-www-backup.tar.gz" -C /var/www/awesomeiwb dist 2>/dev/null || true',
      'if [ -d "' + PANEL_DIST + '" ]; then tar -czf "$BACKUP_DIR/dist-panel-backup.tar.gz" -C "$(dirname ' + PANEL_DIST + ')" "$(basename ' + PANEL_DIST + ')" 2>/dev/null || true; fi',
      'cp /opt/awesomeiwb/backend/src/index.ts "$BACKUP_DIR/index.ts.bak" 2>/dev/null || true',
      'echo "$TS|$BACKUP_DIR" | tee /opt/awesomeiwb/backups/LATEST_ROLE_TEMPLATES.txt',
    ].join('\n');
    const backupCode = await exec(conn, backup, 'Create backup');
    if (backupCode !== 0) throw new Error('backup failed');

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    for (const rel of UPLOAD_FILES) {
      const local = path.join(ROOT, rel);
      const remote = '/opt/awesomeiwb/' + rel.replace(/\\/g, '/');
      const remoteDir = remote.substring(0, remote.lastIndexOf('/'));
      await new Promise((resolve) => sf.mkdir(remoteDir, () => resolve()));
      await upload(sf, local, remote);
      console.log('Uploaded ' + rel);
    }

    const deploy = [
      'set -e',
      'cd /opt/awesomeiwb/frontend',
      'VITE_SSG_API_BASE=https://aiwb.smart-teach.cn npm run build 2>&1 | tail -25',
      'WWW=' + WWW,
      'PANEL=' + PANEL_DIST,
      'rm -rf "$WWW"/*',
      'cp -r /opt/awesomeiwb/frontend/dist/* "$WWW"/',
      'if [ -d "$PANEL" ]; then rm -rf "$PANEL"/*; cp -r /opt/awesomeiwb/frontend/dist/* "$PANEL"/; fi',
      'cd /opt/awesomeiwb/deploy',
      'docker compose build backend',
      'docker compose up -d backend',
      'sleep 5',
      "curl -sS -o /dev/null -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health",
      'echo',
      'grep -l normalizeRoleTemplates "$WWW"/assets/UsersView-*.js 2>/dev/null | head -1 || ls "$WWW"/assets/UsersView-*.js | head -1',
    ].join('\n');
    const code = await exec(conn, deploy, 'Remote build + deploy + docker', 1200000);
    if (code !== 0) process.exit(code);
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 600000 });
