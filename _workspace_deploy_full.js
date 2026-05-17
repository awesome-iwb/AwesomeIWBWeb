const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCAL_ROOT = 'D:\\github\\AwesomeIWBWeb';
const ART = path.join(LOCAL_ROOT, '_deploy_artifacts');
const HOST = '210.16.165.251';
const USER = 'root';
const PASS = process.env.SSH_PASS || process.env.DEPLOY_SSH_PASSWORD;
const REMOTE_BACKEND = '/opt/awesomeiwb/backend';
const REMOTE_DEPLOY = '/opt/awesomeiwb/deploy';
const DIST_PATHS = [
  '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist',
  '/var/www/awesomeiwb/dist',
];

if (!PASS) { console.error('Missing SSH_PASS'); process.exit(1); }

function sh(cmd, cwd) {
  console.log('>>', cmd.slice(0, 120));
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

fs.mkdirSync(ART, { recursive: true });
const backendTar = path.join(ART, 'backend-deploy.tar.gz');
const distTar = path.join(ART, 'dist-deploy.tar.gz');

sh(`tar -czf "${backendTar}" --exclude=node_modules --exclude=.git --exclude=.env -C "${path.join(LOCAL_ROOT, 'backend')}" .`, LOCAL_ROOT);
sh(`tar -czf "${distTar}" -C "${path.join(LOCAL_ROOT, 'frontend', 'dist')}" .`, LOCAL_ROOT);

console.log('Tars:', fs.statSync(backendTar).size, fs.statSync(distTar).size);

function exec(conn, cmd, label, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    console.log('\n>>>', label || cmd.slice(0, 80));
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      const t = setTimeout(() => {}, timeoutMs);
      stream.on('data', d => { out += d; process.stdout.write(d); });
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', code => { clearTimeout(t); resolve({ code, out }); });
    });
  });
}

function sftp(conn) {
  return new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
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
    const probe = await exec(conn, [
      'echo "=== dist paths ==="',
      'for d in ' + DIST_PATHS.map(p => '"' + p + '"').join(' ') + '; do echo "-- $d"; ls -la "$d" 2>/dev/null | head -2 || echo missing; done',
      'echo "=== nginx/openresty root hints ==="',
      'grep -R "aiwb.smart-teach.cn" /opt/1panel/apps/openresty 2>/dev/null | grep -E "root |alias " | head -8 || true',
      'grep -R "awesomeiwb" /etc/nginx 2>/dev/null | grep root | head -5 || true',
    ].join('\n'), 'Probe dist roots');

    const primaryDist = DIST_PATHS[0];
    const backupDist = DIST_PATHS[1];

    const backupCmd = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR" /opt/awesomeiwb/backups',
      "OLD_IMAGE=$(docker images deploy-backend --format '{{.ID}}' 2>/dev/null | head -1 || true)",
      '[ -z "$OLD_IMAGE" ] && OLD_IMAGE=none',
      'echo Backup dir: $BACKUP_DIR',
      'cd ' + REMOTE_BACKEND + ' && tar --exclude=node_modules --exclude=.git -czf "$BACKUP_DIR/backend-backup.tar.gz" .',
      'tar -czf "$BACKUP_DIR/dist-primary-backup.tar.gz" -C "$(dirname ' + primaryDist + ')" "$(basename ' + primaryDist + ')"',
      'if [ -d ' + backupDist + ' ]; then tar -czf "$BACKUP_DIR/dist-varwww-backup.tar.gz" -C "$(dirname ' + backupDist + ')" "$(basename ' + backupDist + ')"; fi',
      'SUMMARY="$TS|$BACKUP_DIR/backend-backup.tar.gz|$BACKUP_DIR/dist-primary-backup.tar.gz|$OLD_IMAGE"',
      'echo "$SUMMARY" > /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
      'cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
    ].join('\n');

    const b = await exec(conn, backupCmd, 'Pre-deploy backup');
    if (b.code !== 0) throw new Error('backup failed ' + b.code);

    const sf = await sftp(conn);
    await upload(sf, backendTar, '/tmp/backend-deploy.tar.gz');
    await upload(sf, distTar, '/tmp/dist-deploy.tar.gz');
    await upload(sf, path.join(ART, 'rollback-last.sh'), '/opt/awesomeiwb/backups/rollback-last.sh');
    console.log('Upload complete');

    const deployPaths = DIST_PATHS.map(d => [
      'mkdir -p ' + d,
      'rm -rf ' + d + '/*',
      'tar -xzf /tmp/dist-deploy.tar.gz -C ' + d,
      'echo synced ' + d,
    ].join('\n')).join('\n');

    const deployCmd = [
      'set -e',
      'chmod +x /opt/awesomeiwb/backups/rollback-last.sh',
      'echo Extract backend...',
      'tar -xzf /tmp/backend-deploy.tar.gz -C ' + REMOTE_BACKEND,
      deployPaths,
      'cd ' + REMOTE_DEPLOY,
      'docker compose build --no-cache backend',
      'docker compose up -d',
      'sleep 5',
      'docker compose logs backend --tail 40 2>&1 || docker logs awesomeiwb-backend-1 --tail 40 2>&1 || true',
      'for i in 1 2 3 4 5; do',
      '  CODE=$(curl -sS -o /tmp/health_body.txt -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/health || echo 000)',
      '  echo HEALTH_ATTEMPT_$i=$CODE',
      '  [ "$CODE" = "200" ] && break',
      '  sleep 3',
      'done',
      'echo HEALTH_BODY:',
      'head -c 400 /tmp/health_body.txt; echo',
      'echo ANALYTICS_NO_TOKEN:',
      'curl -sS -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" "http://127.0.0.1/api/admin/analytics?days=7" || true',
      'echo',
      'echo VERIFY_DIST_GREP:',
      'grep -rl "displayRole" ' + primaryDist + '/assets 2>/dev/null | head -2 || echo no displayRole in primary',
      'grep -rl "SiteReloadBanner" ' + primaryDist + '/assets 2>/dev/null | head -2 || echo no SiteReloadBanner',
      'grep -rl "canViewAnalytics" ' + primaryDist + '/assets 2>/dev/null | head -2 || echo no canViewAnalytics',
      'echo VERIFY_BACKEND_FILES:',
      'test -f ' + REMOTE_BACKEND + '/src/domain/displayRole.ts && echo displayRole.ts OK || echo displayRole.ts MISSING',
      'test -f ' + REMOTE_BACKEND + '/src/services/analytics.ts && echo analytics.ts OK || echo analytics.ts MISSING',
      'grep -n interval ' + REMOTE_BACKEND + '/src/services/analytics.ts | head -3 || true',
      'BUILD_ID=$(grep -ro "buildId[^,]*" ' + primaryDist + '/index.html 2>/dev/null | head -1 || echo none)',
      'echo BUILD_ID_HINT=$BUILD_ID',
      'rm -f /tmp/backend-deploy.tar.gz /tmp/dist-deploy.tar.gz',
    ].join('\n');

    const d = await exec(conn, deployCmd, 'Deploy docker + verify', 900000);
    if (d.code !== 0) throw new Error('deploy exit ' + d.code);

    conn.end();
    process.exit(0);
  } catch (e) {
    console.error('FAIL', e);
    conn.end();
    process.exit(1);
  }
}).on('error', e => { console.error('SSH', e.message); process.exit(1); })
.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000 });
