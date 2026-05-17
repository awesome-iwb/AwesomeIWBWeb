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
const ART = path.join(ROOT, '_deploy_artifacts');
const DIST_TAR = path.join(ART, 'dist-floating-panel.tar.gz');
const DIST_PATHS = [
  '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist',
  '/var/www/awesomeiwb/dist',
];

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Missing frontend/dist');
  process.exit(1);
}

fs.mkdirSync(ART, { recursive: true });
execSync(`tar -czf "${DIST_TAR}" -C "${DIST}" .`, { stdio: 'inherit' });

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>>', label || cmd.slice(0, 100));
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => resolve(code ?? 0));
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
      'tar -czf "$BACKUP_DIR/dist-primary-backup.tar.gz" -C "$(dirname ' + DIST_PATHS[0] + ')" "$(basename ' + DIST_PATHS[0] + ')"',
      'if [ -d ' + DIST_PATHS[1] + ' ]; then tar -czf "$BACKUP_DIR/dist-varwww-backup.tar.gz" -C "$(dirname ' + DIST_PATHS[1] + ')" "$(basename ' + DIST_PATHS[1] + ')"; fi',
      'echo "$TS|$BACKUP_DIR" > /opt/awesomeiwb/backups/LATEST_FLOATING_PANEL.txt',
      'cat /opt/awesomeiwb/backups/LATEST_FLOATING_PANEL.txt',
    ].join('\n');
    const b = await exec(conn, backup, 'Backup both dist paths');
    if (b !== 0) throw new Error('backup failed');

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    await upload(sf, DIST_TAR, '/tmp/dist-floating-panel.tar.gz');

    const sync = DIST_PATHS.map((d) => [
      'mkdir -p ' + d,
      'rm -rf ' + d + '/*',
      'tar -xzf /tmp/dist-floating-panel.tar.gz -C ' + d,
      'echo synced ' + d,
    ].join('\n')).join('\n');

    const deploy = [
      'set -e',
      sync,
      'grep -rl "FloatingPanel" ' + DIST_PATHS[0] + '/assets 2>/dev/null | head -1 || echo missing FloatingPanel chunk',
      'for i in 1 2 3 4 5; do',
      '  CODE=$(curl -sS -o /tmp/health_body.txt -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/health || echo 000)',
      '  echo HEALTH_ATTEMPT_$i=$CODE',
      '  [ "$CODE" = "200" ] && break',
      '  sleep 2',
      'done',
      'head -c 200 /tmp/health_body.txt; echo',
      'test "$(curl -sS -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/health)" = "200"',
      'rm -f /tmp/dist-floating-panel.tar.gz',
    ].join('\n');

    const code = await exec(conn, deploy, 'Deploy dist + health');
    if (code !== 0) throw new Error('deploy failed ' + code);
    conn.end();
    console.log('\nDEPLOY OK');
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 60000 });
