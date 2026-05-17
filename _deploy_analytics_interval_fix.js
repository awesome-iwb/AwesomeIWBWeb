const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const pass = process.env.SSH_PASS;
if (!pass) {
  console.error('SSH_PASS required');
  process.exit(1);
}

const ANALYTICS = path.join(__dirname, 'backend', 'src', 'services', 'analytics.ts');
const BACKEND = '/opt/awesomeiwb/backend';

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 120)));
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
      'cp ' + BACKEND + '/src/services/analytics.ts "$BACKUP_DIR/analytics.ts.bak" 2>/dev/null || true',
      'echo "$TS|$BACKUP_DIR" > /opt/awesomeiwb/backups/LATEST_ANALYTICS_INTERVAL_FIX.txt',
      'cat /opt/awesomeiwb/backups/LATEST_ANALYTICS_INTERVAL_FIX.txt',
    ].join('\n');
    await exec(conn, backup, 'Backup analytics.ts');

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    await upload(sf, ANALYTICS, '/tmp/analytics.ts.fix');
    console.log('Uploaded analytics.ts');

    const deploy = [
      'set -e',
      'cp /tmp/analytics.ts.fix ' + BACKEND + '/src/services/analytics.ts',
      'cp /tmp/analytics.ts.fix ' + BACKEND + '/src/services/analytics.test.ts 2>/dev/null || true',
      'cd /opt/awesomeiwb/deploy',
      'docker compose build backend',
      'docker compose up -d backend',
      'sleep 4',
      "curl -sS -o /dev/null -w 'health:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health",
      'docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "select count(*)::text as pv_total from page_views where created_at >= now() - 7 * interval \'1 day\'"',
      'rm -f /tmp/analytics.ts.fix',
    ].join('\n');
    const code = await exec(conn, deploy, 'Deploy backend analytics fix');
    if (code !== 0) process.exit(code);
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 600000 });
