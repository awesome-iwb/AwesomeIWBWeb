const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '210.16.165.251';
const username = 'root';
const password = '8EGZ4jf3vumREH';

const localHttps = path.resolve('deploy/nginx/awesomeiwb-https.conf');
const localIp = path.resolve('deploy/nginx/awesomeiwb-ip.conf');

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => (stdout += d.toString()));
      stream.stderr.on('data', (d) => (stderr += d.toString()));
      stream.on('close', (code) => resolve({ code, stdout, stderr, cmd }));
    });
  });
}

function put(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(localPath);
    const ws = sftp.createWriteStream(remotePath);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('close', resolve);
    rs.pipe(ws);
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host,
      port: 22,
      username,
      password,
      readyTimeout: 60000,
      keepaliveInterval: 10000,
    });
  });

  const openrestyConfDir = '/opt/1panel/apps/openresty/openresty/conf';
  const remoteConfD = `${openrestyConfDir}/conf.d`;
  const remoteHttps = `${remoteConfD}/awesomeiwb-https.conf`;
  const remoteIp = `${remoteConfD}/awesomeiwb-ip.conf`;

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  const probe = await exec(
    conn,
    `set -e; ` +
      `echo 'MASTER:'; ps -ef | grep 'openresty -g daemon off' | grep -v grep | head -1 || true; ` +
      `echo 'CONF_DIR_EXISTS:'; [ -d '${openrestyConfDir}' ] && echo yes || echo no; ` +
      `echo 'INCLUDES:'; sed -n '1,220p' ${openrestyConfDir}/nginx.conf | grep include || true; ` +
      `echo 'CONFD:'; ls -la ${remoteConfD} || true;`
  );
  process.stdout.write(probe.stdout + probe.stderr);

  await exec(conn, `mkdir -p ${remoteConfD}`);
  await put(sftp, localHttps, remoteHttps);
  await put(sftp, localIp, remoteIp);
  console.log(`uploaded -> ${remoteHttps}`);
  console.log(`uploaded -> ${remoteIp}`);

  const test = await exec(conn, '/usr/local/openresty/bin/openresty -t');
  process.stdout.write(test.stdout + test.stderr);
  if (test.code !== 0) {
    conn.end();
    process.exit(1);
  }

  const reload = await exec(conn, '/usr/local/openresty/bin/openresty -s reload');
  process.stdout.write(reload.stdout + reload.stderr);
  if (reload.code !== 0) {
    conn.end();
    process.exit(1);
  }

  const checks = [
    "curl -sSI https://aiwb.stcn.moe/api/auth/me | sed -n '1,20p'",
    "curl -sSI https://aiwb.stcn.moe/api/feedback | sed -n '1,20p'",
    "curl -sSI https://aiwb.stcn.moe/api/stories | sed -n '1,20p'",
    "curl -sSI https://aiwb.stcn.moe/api/projects | sed -n '1,20p'",
    "etag=$(curl -sSI https://aiwb.stcn.moe/api/stories | tr -d '\\r' | awk -F': ' 'tolower($1)==\"etag\"{print $2}' | tail -1); echo ETAG=$etag; if [ -n \"$etag\" ]; then curl -sSI -H \"If-None-Match: $etag\" https://aiwb.stcn.moe/api/stories | sed -n '1,20p'; fi",
  ];

  for (const cmd of checks) {
    const out = await exec(conn, cmd);
    console.log(`\n--- ${cmd} ---`);
    process.stdout.write(out.stdout + out.stderr);
  }

  conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
