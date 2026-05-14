const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '210.16.165.251';
const user = 'root';
const password = '8EGZ4jf3vumREH';

const uploads = [
  ['deploy/nginx/awesomeiwb-https.conf', '/etc/nginx/conf.d/awesomeiwb-https.conf'],
  ['deploy/nginx/awesomeiwb-ip.conf', '/etc/nginx/conf.d/awesomeiwb-ip.conf'],
];

function put(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(path.resolve(localPath));
    const ws = sftp.createWriteStream(remotePath);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('close', resolve);
    rs.pipe(ws);
  });
}

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

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host,
      port: 22,
      username: user,
      password,
      readyTimeout: 60000,
      keepaliveInterval: 10000,
    });
  });

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  for (const [localPath, remotePath] of uploads) {
    await put(sftp, localPath, remotePath);
    console.log(`uploaded ${localPath} -> ${remotePath}`);
  }

  const preflight = await exec(conn, 'nginx -t');
  process.stdout.write(preflight.stdout + preflight.stderr);
  if (preflight.code !== 0) {
    conn.end();
    process.exit(1);
  }

  const reload = await exec(conn, 'systemctl reload nginx && echo reloaded-nginx');
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
    console.log(`\n--- ${cmd} ---`);
    const out = await exec(conn, cmd);
    process.stdout.write(out.stdout + out.stderr);
  }

  conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
