const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = process.env.SSH_PASS || process.env.DEPLOY_SSH_PASSWORD;
const ART = path.join('D:', 'github', 'AwesomeIWBWeb', '_deploy_artifacts');
const BACKEND_TAR = path.join(ART, 'backend-deploy.tar.gz');
const DIST_TAR = path.join(ART, 'dist-deploy.tar.gz');
const DIST_DIR = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';
const BACKEND_DIR = '/opt/awesomeiwb/backend';
const DEPLOY_DIR = '/opt/awesomeiwb/deploy';

if (!PASS) { console.error('Missing SSH_PASS'); process.exit(1); }

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 100)));
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { out += d; process.stdout.write(d); });
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', code => resolve({ code, out }));
    });
  });
}

function sftp(conn) {
  return new Promise((resolve, reject) => conn.sftp((e, s) => (e ? reject(e) : resolve(s))));
}

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(local);
    const ws = sftp.createWriteStream(remote);
    ws.on('close', resolve);
    ws.on('error', reject);
    rs.on('error', reject);
    rs.pipe(ws);
  });
}

const ROLLBACK_LOCAL = path.join(ART, 'rollback-last.sh');

const conn = new Client();
conn.on('ready', async () => {
  try {
    console.log('SSH connected');
    const backupCmd = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR" /opt/awesomeiwb/backups',
      "OLD_IMAGE=$(docker images deploy-backend --format '{{.ID}}' 2>/dev/null | head -1 || true)",
      'if [ -z "$OLD_IMAGE" ]; then OLD_IMAGE=none; fi',
      'echo "Backup dir: $BACKUP_DIR"',
      'echo "Old image: $OLD_IMAGE"',
      'cd ' + BACKEND_DIR + ' && tar --exclude=node_modules -czf "$BACKUP_DIR/backend-backup.tar.gz" .',
      'tar -czf "$BACKUP_DIR/dist-backup.tar.gz" -C "$(dirname ' + DIST_DIR + ')" "$(basename ' + DIST_DIR + ')"',
      'SUMMARY="$TS|$BACKUP_DIR/backend-backup.tar.gz|$BACKUP_DIR/dist-backup.tar.gz|$OLD_IMAGE"',
      'echo "$SUMMARY" > /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
      'echo "LATEST_ROLLBACK: $SUMMARY"',
      'cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
    ].join('\n');

    const b = await exec(conn, backupCmd, 'Pre-deploy backup');
    if (b.code !== 0) throw new Error('backup failed');

    const sf = await sftp(conn);
    console.log('\n>>> Uploading tars + rollback script...');
    await upload(sf, BACKEND_TAR, '/tmp/backend-deploy.tar.gz');
    await upload(sf, DIST_TAR, '/tmp/dist-deploy.tar.gz');
    await upload(sf, ROLLBACK_LOCAL, '/opt/awesomeiwb/backups/rollback-last.sh');
    console.log('Upload done');

    const deployCmd = [
      'set -e',
      'chmod +x /opt/awesomeiwb/backups/rollback-last.sh',
      'echo "Extract backend..."',
      'tar -xzf /tmp/backend-deploy.tar.gz -C ' + BACKEND_DIR,
      'echo "Extract dist..."',
      'rm -rf ' + DIST_DIR + '/*',
      'tar -xzf /tmp/dist-deploy.tar.gz -C ' + DIST_DIR,
      'cd ' + DEPLOY_DIR,
      'docker compose build --no-cache backend',
      'docker compose up -d',
      "echo -n HEALTH_HTTP_CODE=",
      "curl -sS -o /tmp/health_body.txt -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health || echo FAIL",
      'echo',
      'echo HEALTH_BODY:',
      'head -c 500 /tmp/health_body.txt || true',
      'echo',
      'rm -f /tmp/backend-deploy.tar.gz /tmp/dist-deploy.tar.gz',
    ].join('\n');

    const d = await exec(conn, deployCmd, 'Deploy + docker');
    if (d.code !== 0) throw new Error('deploy failed');

    await exec(conn, 'cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt', 'Rollback pointer');
    conn.end();
    process.exit(0);
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).on('error', e => { console.error('SSH', e.message); process.exit(1); })
.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 600000 });
