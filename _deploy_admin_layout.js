const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCAL_ROOT = path.join(__dirname);
const ART = path.join(LOCAL_ROOT, '_deploy_artifacts');
const PASS = process.env.SSH_PASS || '8EGZ4jf3vumREH';
const DIST_PATHS = [
  '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist',
  '/var/www/awesomeiwb/dist',
];

fs.mkdirSync(ART, { recursive: true });
const distTar = path.join(ART, 'dist-admin-layout.tar.gz');
execSync(`tar -czf "${distTar}" -C "${path.join(LOCAL_ROOT, 'frontend', 'dist')}" .`, { stdio: 'inherit' });

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>>', label);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => resolve(code));
    });
  });
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    const sftp = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    await new Promise((resolve, reject) => {
      const rs = fs.createReadStream(distTar);
      const ws = sftp.createWriteStream('/tmp/dist-admin-layout.tar.gz');
      ws.on('close', resolve);
      ws.on('error', reject);
      rs.pipe(ws);
    });
    console.log('Uploaded dist tar');

    const deployCmd = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP="/opt/awesomeiwb/backups/admin-layout-$TS"',
      'mkdir -p "$BACKUP"',
      `tar -czf "$BACKUP/dist-primary.tar.gz" -C "$(dirname ${DIST_PATHS[0]})" "$(basename ${DIST_PATHS[0]})"`,
      `if [ -d ${DIST_PATHS[1]} ]; then tar -czf "$BACKUP/dist-varwww.tar.gz" -C "$(dirname ${DIST_PATHS[1]})" "$(basename ${DIST_PATHS[1]})"; fi`,
      ...DIST_PATHS.map((p) => [
        `mkdir -p ${p}`,
        `rm -rf ${p}/*`,
        `tar -xzf /tmp/dist-admin-layout.tar.gz -C ${p}`,
        `echo deployed ${p}`,
      ]).flat(),
      'curl -sk -o /dev/null -w "admin/projects HTTP %{http_code}\\n" https://aiwb.smart-teach.cn/admin/projects',
    ].join('\n');

    const code = await exec(conn, deployCmd, 'Deploy dist to both paths');
    console.log('Exit', code);
    conn.end();
  } catch (e) {
    console.error(e);
    conn.end();
    process.exit(1);
  }
});
conn.on('error', (e) => { console.error(e); process.exit(1); });
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: PASS, readyTimeout: 20000 });
