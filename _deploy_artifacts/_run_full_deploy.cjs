const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PASS = process.env.SSH_PASS;
if (!PASS) { console.error('SSH_PASS required'); process.exit(1); }

const ART = path.join('D:', 'github', 'AwesomeIWBWeb', '_deploy_artifacts');
const BACKEND_TAR = path.join(ART, 'backend-deploy.tar.gz');
const DIST_TAR = path.join(ART, 'dist-deploy.tar.gz');

const OPENRESTY_DIST = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';
const WWW_DIST = '/var/www/awesomeiwb/dist';
const BACKEND_DIR = '/opt/awesomeiwb/backend';
const DEPLOY_DIR = '/opt/awesomeiwb/deploy';

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 100)));
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let code = 0;
      stream.on('data', d => process.stdout.write(d));
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', c => resolve(c ?? 0));
    });
  });
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

async function must(conn, cmd, label) {
  const code = await exec(conn, cmd, label);
  if (code !== 0) throw new Error(`Failed (${code}): ${label || cmd}`);
  return code;
}

const conn = new Client();
conn.on('ready', async () => {
  let backupDir = '';
  let healthCode = '';
  try {
    const backupScript = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR"',
      '[ -d /var/www/awesomeiwb/dist ] && tar -czf "$BACKUP_DIR/www-dist.tar.gz" -C /var/www/awesomeiwb dist || true',
      `[ -d ${OPENRESTY_DIST} ] && tar -czf "$BACKUP_DIR/openresty-dist.tar.gz" -C ${OPENRESTY_DIST.replace('/dist','')} dist || true`,
      `tar -czf "$BACKUP_DIR/backend.tar.gz" -C /opt/awesomeiwb backend --exclude=node_modules --exclude=.git --exclude=.env 2>/dev/null || true`,
      'echo "$TS|$BACKUP_DIR" > /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
      'cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
      'echo BACKUP_DIR=$BACKUP_DIR',
    ].join('\n');
    const backupOut = await new Promise((res, rej) => {
      let out = '';
      conn.exec(backupScript, (err, stream) => {
        if (err) return rej(err);
        stream.on('data', d => { out += d; process.stdout.write(d); });
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', c => c === 0 ? res(out) : rej(new Error('backup failed ' + c)));
      });
    });
    const m = backupOut.match(/BACKUP_DIR=([^\r\n]+)/);
    backupDir = m ? m[1] : (backupOut.match(/deploy-\d{8}-\d{6}/) || [''])[0];

    const sftp = await new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));
    await upload(sftp, BACKEND_TAR, '/tmp/backend-deploy.tar.gz');
    await upload(sftp, DIST_TAR, '/tmp/dist-deploy.tar.gz');
    console.log('\nUploaded archives');

    const deployScript = [
      'set -e',
      'mkdir -p ' + BACKEND_DIR + ' ' + WWW_DIST + ' ' + OPENRESTY_DIST,
      'find ' + BACKEND_DIR + ' -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +',
      'tar -xzf /tmp/backend-deploy.tar.gz -C ' + BACKEND_DIR,
      'rm -rf ' + WWW_DIST + '/*',
      'tar -xzf /tmp/dist-deploy.tar.gz -C ' + WWW_DIST,
      'rm -rf ' + OPENRESTY_DIST + '/*',
      'tar -xzf /tmp/dist-deploy.tar.gz -C ' + OPENRESTY_DIST,
      'chown -R www-data:www-data ' + WWW_DIST + ' || true',
      'cd ' + DEPLOY_DIR,
      'docker compose build --no-cache backend',
      'docker compose up -d backend',
      'sleep 8',
      "HC=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health || echo 000)",
      'echo HEALTH_CODE=$HC',
      'rm -f /tmp/backend-deploy.tar.gz /tmp/dist-deploy.tar.gz',
    ].join('\n');

    const deployOut = await new Promise((res, rej) => {
      let out = '';
      conn.exec(deployScript, (err, stream) => {
        if (err) return rej(err);
        stream.on('data', d => { out += d; process.stdout.write(d); });
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', c => c === 0 ? res(out) : rej(new Error('deploy failed ' + c)));
      });
    });
    const hm = deployOut.match(/HEALTH_CODE=(\d+)/);
    healthCode = hm ? hm[1] : 'unknown';

    console.log('\n=== DEPLOY_SUMMARY ===');
    console.log('BUILD_METHOD=npm run build');
    console.log('BACKUP_PATH=' + backupDir);
    console.log('HEALTH=' + healthCode);
    console.log(healthCode === '200' ? 'STATUS=SUCCESS' : 'STATUS=FAILED');
    conn.end();
    if (healthCode !== '200') process.exit(2);
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: PASS, readyTimeout: 600000 });
