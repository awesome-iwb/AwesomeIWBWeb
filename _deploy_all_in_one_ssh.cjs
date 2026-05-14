const { Client } = require('ssh2');
const fs = require('fs');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';

const uploads = [
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\src\\api\\endpoints.ts', remote: '/opt/awesomeiwb/frontend/src/api/endpoints.ts' },
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\src\\composables\\useApi.ts', remote: '/opt/awesomeiwb/frontend/src/composables/useApi.ts' },
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\src\\composables\\useAuth.ts', remote: '/opt/awesomeiwb/frontend/src/composables/useAuth.ts' },
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\src\\main.ts', remote: '/opt/awesomeiwb/frontend/src/main.ts' },
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\src\\env.d.ts', remote: '/opt/awesomeiwb/frontend/src/env.d.ts' },
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\src\\registerSW.ts', remote: '/opt/awesomeiwb/frontend/src/registerSW.ts' },
  { local: 'd:\\github\\AwesomeIWBWeb\\frontend\\vite.config.ts', remote: '/opt/awesomeiwb/frontend/vite.config.ts' },
];

const STATIC_CONF = `location = / {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files /index.html =404;
}

location = /index.html {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location = /me {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files /me.html /index.html =404;
}

location = /me.html {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri /index.html =404;
}

location ~* ^/.*auth.*callback.*\.html$ {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri /index.html =404;
}

location = /registerSW.js {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location = /manifest.webmanifest {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location = /sw.js {
    root /www/sites/aiwb.smart-teach.cn/dist;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
}

location / {
    root /www/sites/aiwb.smart-teach.cn/dist;
    index index.html;
    try_files $uri $uri/ /index.html;
}

location ^~ /assets/ {
    root /www/sites/aiwb.smart-teach.cn/dist;
    expires 365d;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location ~* \.(woff2?|svg|png|jpg|jpeg|webp|ico)$ {
    root /www/sites/aiwb.smart-teach.cn/dist;
    expires 7d;
    add_header Cache-Control "public, max-age=604800" always;
}
`;

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

async function ensureRemoteDir(conn, remotePath) {
  const dir = remotePath.split('/').slice(0, -1).join('/');
  await exec(conn, `mkdir -p ${dir}`);
}

async function must(conn, cmd) {
  const out = await exec(conn, cmd);
  process.stdout.write(`\n--- ${cmd} ---\n${out.stdout}${out.stderr}`);
  if (out.code !== 0) throw new Error(`Command failed (${out.code}): ${cmd}`);
  return out;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      port: 22,
      username: USER,
      password: PASS,
      readyTimeout: 60000,
      keepaliveInterval: 10000,
    });
  });

  try {
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
    });

    for (const item of uploads) {
      process.stdout.write(`\nUploading ${item.local} -> ${item.remote}\n`);
      await ensureRemoteDir(conn, item.remote);
      await put(sftp, item.local, item.remote);
    }

    await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build');

    // Sync to both candidate roots to eliminate path mismatch risk.
    await must(conn, 'mkdir -p /var/www/awesomeiwb/dist /www/sites/aiwb.smart-teach.cn/dist');
    await must(conn, 'rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/');
    await must(conn, 'rsync -a --delete /opt/awesomeiwb/frontend/dist/ /www/sites/aiwb.smart-teach.cn/dist/');

    await must(conn, "cat > /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf <<'EOF'\n" + STATIC_CONF + "\nEOF");

    await must(conn, "docker exec 1Panel-openresty-zpMY sh -lc 'openresty -t && openresty -s reload'");

    await must(conn, "docker exec 1Panel-openresty-zpMY sh -lc 'sed -n \"1,220p\" /www/sites/aiwb.smart-teach.cn/proxy/static.conf'");
    await must(conn, "curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/sw.js | sed -n '1,20p'");
    await must(conn, "curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/index.html | sed -n '1,20p'");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/sw.js | sed -n '1,20p'");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/me | sed -n '1,20p'");

    console.log('\nALL_IN_ONE_DEPLOY_OK');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
