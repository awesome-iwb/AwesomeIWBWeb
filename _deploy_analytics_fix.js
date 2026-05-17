const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pass = process.env.SSH_PASS;
if (!pass) { console.error('SSH_PASS required'); process.exit(1); }

const DIST = path.join('D:', 'github', 'AwesomeIWBWeb', 'frontend', 'dist');
const TAR = path.join('D:', 'github', 'AwesomeIWBWeb', '_deploy_artifacts', 'dist-analytics-fix.tar.gz');
const INDEX = path.join('D:', 'github', 'AwesomeIWBWeb', 'backend', 'src', 'index.ts');
const WWW = '/var/www/awesomeiwb/dist';
const BACKEND = '/opt/awesomeiwb/backend';

fs.mkdirSync(path.dirname(TAR), { recursive: true });
execSync(`tar -czf "${TAR}" -C "${DIST}" .`, { stdio: 'inherit' });

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 120)));
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', d => process.stdout.write(d));
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', code => resolve(code ?? 0));
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
      'tar -czf "$BACKUP_DIR/dist-backup.tar.gz" -C /var/www/awesomeiwb dist',
      'cp /opt/awesomeiwb/backend/src/index.ts "$BACKUP_DIR/index.ts.bak" 2>/dev/null || true',
      'echo "$TS|$BACKUP_DIR" > /opt/awesomeiwb/backups/LATEST_ANALYTICS_FIX.txt',
      'cat /opt/awesomeiwb/backups/LATEST_ANALYTICS_FIX.txt',
    ].join('\n');
    await exec(conn, backup, 'Backup dist + index.ts');

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));
    await upload(sf, TAR, '/tmp/dist-analytics-fix.tar.gz');
    await upload(sf, INDEX, '/tmp/index.ts.analytics-fix');
    console.log('Uploaded tar + index.ts');

    const deploy = [
      'set -e',
      'rm -rf ' + WWW + '/*',
      'tar -xzf /tmp/dist-analytics-fix.tar.gz -C ' + WWW,
      'cp /tmp/index.ts.analytics-fix ' + BACKEND + '/src/index.ts',
      'cd /opt/awesomeiwb/deploy',
      'docker compose build backend',
      'docker compose up -d backend',
      'sleep 3',
      "curl -sS -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health",
      'echo',
      'grep -l canViewAnalytics ' + WWW + '/assets/DashboardView-*.js | head -1',
      'rm -f /tmp/dist-analytics-fix.tar.gz /tmp/index.ts.analytics-fix',
    ].join('\n');
    const code = await exec(conn, deploy, 'Deploy dist + backend rebuild');
    if (code !== 0) process.exit(code);
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 600000 });
