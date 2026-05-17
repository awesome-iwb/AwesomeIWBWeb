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
const DIST_TAR = path.join(ARTIFACTS, 'dist-floating-collapse.tar.gz');
const DIST_PATHS = [
  '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist',
  '/var/www/awesomeiwb/dist',
];

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Missing frontend/dist — run build first');
  process.exit(1);
}

fs.mkdirSync(ARTIFACTS, { recursive: true });
execSync(`tar -czf "${DIST_TAR}" -C "${DIST}" .`, { stdio: 'inherit' });
console.log('dist tar:', fs.statSync(DIST_TAR).size);

function exec(conn, cmd, label, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 120)));
    const timer = setTimeout(() => reject(new Error('timeout: ' + label)), timeoutMs);
    conn.exec(cmd, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }
      let out = '';
      stream.on('data', (d) => {
        out += d;
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out });
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
  let backupDir = '';
  try {
    const backup = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR" /opt/awesomeiwb/backups',
      'for d in ' + DIST_PATHS.map((p) => '"' + p + '"').join(' ') + '; do',
      '  if [ -d "$d" ] && [ "$(ls -A "$d" 2>/dev/null)" ]; then',
      '    name=$(echo "$d" | tr "/" "_")',
      '    tar -czf "$BACKUP_DIR/dist-${name}.tar.gz" -C "$(dirname "$d")" "$(basename "$d")" 2>/dev/null || true',
      '  fi',
      'done',
      'echo "BACKUP_DIR=$BACKUP_DIR"',
    ].join('\n');
    const b = await exec(conn, backup, 'Backup dist paths');
    if (b.code !== 0) throw new Error('backup failed');
    const m = b.out.match(/BACKUP_DIR=(.+)/);
    backupDir = m ? m[1].trim() : '';

    const sf = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    await upload(sf, DIST_TAR, '/tmp/dist-floating-collapse.tar.gz');

    const deployLines = [
      'set -e',
      ...DIST_PATHS.flatMap((d) => [
        'mkdir -p "' + d + '"',
        'rm -rf "' + d + '"/*',
        'tar -xzf /tmp/dist-floating-collapse.tar.gz -C "' + d + '"',
      ]),
      'HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/health)',
      'echo "health=$HTTP"',
      'test "$HTTP" = "200"',
      'ls "' + DIST_PATHS[0] + '/assets/FloatingPanel-"*.js | head -1',
      'rm -f /tmp/dist-floating-collapse.tar.gz',
    ];
    const d = await exec(conn, deployLines.join('\n'), 'Deploy dual dist + health');
    if (d.code !== 0) throw new Error('deploy exit ' + d.code);

    const h = await exec(
      conn,
      'curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/; echo',
      'Home check'
    );
    console.log('\n=== DONE ===');
    console.log('backup:', backupDir);
    console.log('home:', h.out.trim());
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 600000 });
