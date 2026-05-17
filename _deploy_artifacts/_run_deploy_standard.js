const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = process.env.SSH_PASS || process.env.DEPLOY_SSH_PASSWORD;
const ART = path.join('D:', 'github', 'AwesomeIWBWeb', '_deploy_artifacts');
const BACKEND_TAR = path.join(ART, 'backend-deploy.tar.gz');
const DIST_TAR = path.join(ART, 'dist-deploy.tar.gz');
const DIST_OR = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';
const DIST_WWW = '/var/www/awesomeiwb/dist';
const BACKEND_DIR = '/opt/awesomeiwb/backend';
const DEPLOY_DIR = '/opt/awesomeiwb/deploy';

if (!PASS) { console.error('Missing SSH_PASS'); process.exit(1); }
for (const f of [BACKEND_TAR, DIST_TAR]) {
  if (!fs.existsSync(f)) { console.error('Missing', f); process.exit(1); }
}

function exec(conn, cmd, label) {
  return new Promise((resolve, reject) => {
    console.log('\n>>> ' + (label || cmd.slice(0, 120)));
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
  let backupDir = '';
  let healthCode = '';
  try {
    console.log('SSH 已连接');
    const backupCmd = [
      'set -e',
      'TS=$(date +%Y%m%d-%H%M%S)',
      'BACKUP_DIR="/opt/awesomeiwb/backups/deploy-$TS"',
      'mkdir -p "$BACKUP_DIR" /opt/awesomeiwb/backups',
      "OLD_IMAGE=$(docker images deploy-backend --format '{{.ID}}' 2>/dev/null | head -1 || true)",
      'if [ -z "$OLD_IMAGE" ]; then OLD_IMAGE=none; fi',
      'echo "备份目录: $BACKUP_DIR"',
      'cd ' + BACKEND_DIR + ' && tar --exclude=node_modules -czf "$BACKUP_DIR/backend-backup.tar.gz" .',
      'mkdir -p "$(dirname ' + DIST_OR + ')" "$(dirname ' + DIST_WWW + ')"',
      'tar -czf "$BACKUP_DIR/dist-openresty-backup.tar.gz" -C "$(dirname ' + DIST_OR + ')" "$(basename ' + DIST_OR + ')" 2>/dev/null || true',
      'tar -czf "$BACKUP_DIR/dist-www-backup.tar.gz" -C "$(dirname ' + DIST_WWW + ')" "$(basename ' + DIST_WWW + ')" 2>/dev/null || true',
      'SUMMARY="$TS|$BACKUP_DIR/backend-backup.tar.gz|$BACKUP_DIR/dist-openresty-backup.tar.gz|$OLD_IMAGE"',
      'echo "$SUMMARY" > /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
      'echo "LATEST_ROLLBACK 已写入"',
      'cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt',
    ].join('\n');

    const b = await exec(conn, backupCmd, '部署前备份');
    if (b.code !== 0) throw new Error('备份失败');
    const m = b.out.match(/备份目录: (\/opt\/awesomeiwb\/backups\/deploy-[^\s]+)/);
    backupDir = m ? m[1] : (b.out.match(/deploy-\d{8}-\d{6}/) ? '/opt/awesomeiwb/backups/' + b.out.match(/deploy-\d{8}-\d{6}/)[0] : '');

    const sf = await sftp(conn);
    console.log('\n>>> 上传 tar 包...');
    await upload(sf, BACKEND_TAR, '/tmp/backend-deploy.tar.gz');
    await upload(sf, DIST_TAR, '/tmp/dist-deploy.tar.gz');
    if (fs.existsSync(ROLLBACK_LOCAL)) await upload(sf, ROLLBACK_LOCAL, '/opt/awesomeiwb/backups/rollback-last.sh');
    console.log('上传完成');

    const deployCmd = [
      'set -e',
      'chmod +x /opt/awesomeiwb/backups/rollback-last.sh 2>/dev/null || true',
      'echo "解压 backend..."',
      'tar -xzf /tmp/backend-deploy.tar.gz -C ' + BACKEND_DIR,
      'echo "解压 dist (两处)..."',
      'mkdir -p ' + DIST_OR + ' ' + DIST_WWW,
      'rm -rf ' + DIST_OR + '/* ' + DIST_WWW + '/*',
      'tar -xzf /tmp/dist-deploy.tar.gz -C ' + DIST_OR,
      'cp -a ' + DIST_OR + '/. ' + DIST_WWW + '/',
      'cd ' + DEPLOY_DIR,
      'docker compose build --no-cache backend',
      'docker compose up -d',
      "HEALTH=$(curl -sS -o /tmp/health_body.txt -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health || echo 000)",
      'echo "HEALTH_HTTP_CODE=$HEALTH"',
      'head -c 300 /tmp/health_body.txt 2>/dev/null; echo',
      'rm -f /tmp/backend-deploy.tar.gz /tmp/dist-deploy.tar.gz',
    ].join('\n');

    const d = await exec(conn, deployCmd, '解压 + Docker 重建');
    if (d.code !== 0) throw new Error('部署失败');
    const hm = d.out.match(/HEALTH_HTTP_CODE=(\d+)/);
    healthCode = hm ? hm[1] : 'unknown';

    await exec(conn, 'cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt', '回滚指针');

    console.log('\n======== 部署摘要 ========');
    console.log('备份路径:', backupDir || '(见上方输出)');
    console.log('Health:', healthCode, healthCode === '200' ? '成功' : '失败');
    conn.end();
    process.exit(healthCode === '200' ? 0 : 2);
  } catch (e) {
    console.error('\n部署异常:', e.message);
    console.log('备份路径:', backupDir || '未知');
    console.log('Health:', healthCode || '未检查');
    conn.end();
    process.exit(1);
  }
}).on('error', e => { console.error('SSH 错误:', e.message); process.exit(1); })
.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 600000 });
