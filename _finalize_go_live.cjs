const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '210.16.165.251';
const username = 'root';
const password = '8EGZ4jf3vumREH';

const localApi = path.resolve('_tmp_api.conf');
const localStatic = path.resolve('_tmp_static.conf');

const apiConf = `location ^~ /api/auth/ {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
    add_header Cache-Control "private, no-store" always;
    add_header Vary "Cookie, Authorization" always;
}

location ^~ /api/feedback {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
    add_header Cache-Control "private, no-store" always;
    add_header Vary "Cookie, Authorization" always;
}

location = /api/stories {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
}

location = /api/projects {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
}

location ^~ /api/uploads/ {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location ^~ /api/ {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
}
`;

const staticConf = `location = / {
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

fs.writeFileSync(localApi, apiConf, 'utf8');
fs.writeFileSync(localStatic, staticConf, 'utf8');

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

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  await put(sftp, localApi, '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/api.conf');
  await put(sftp, localStatic, '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf');
  console.log('uploaded proxy/api.conf and proxy/static.conf');

  const steps = [
    'docker exec 1Panel-openresty-zpMY sh -lc "openresty -t"',
    'docker exec 1Panel-openresty-zpMY sh -lc "openresty -s reload"',
    'curl -sSI -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/auth/me | sed -n "1,20p"',
    'curl -sSI -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/feedback | sed -n "1,20p"',
    'curl -sSI -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/stories | sed -n "1,20p"',
    'curl -sSI -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/projects | sed -n "1,20p"',
    'etag=$(curl -sSI -H "Host: aiwb.smart-teach.cn" http://127.0.0.1/api/stories | tr -d "\\r" | awk -F": " \'tolower($1)=="etag"{print $2}\' | tail -1); echo ETAG=$etag; if [ -n "$etag" ]; then curl -sSI -H "Host: aiwb.smart-teach.cn" -H "If-None-Match: $etag" http://127.0.0.1/api/stories | sed -n "1,20p"; fi',
    'curl -sSI https://aiwb.smart-teach.cn/api/auth/me | sed -n "1,20p"',
    'curl -sSI https://aiwb.smart-teach.cn/api/feedback | sed -n "1,20p"',
    'curl -sSI https://aiwb.smart-teach.cn/api/stories | sed -n "1,20p"',
    'curl -sSI https://aiwb.smart-teach.cn/api/projects | sed -n "1,20p"'
  ];

  for (const cmd of steps) {
    const out = await exec(conn, cmd);
    console.log(`\n--- ${cmd} ---`);
    process.stdout.write(out.stdout + out.stderr);
    if (out.code !== 0 && (cmd.includes('openresty -t') || cmd.includes('openresty -s reload'))) {
      conn.end();
      process.exit(1);
    }
  }

  conn.end();
  fs.unlinkSync(localApi);
  fs.unlinkSync(localStatic);
}

main().catch((err) => {
  console.error(err);
  try { fs.unlinkSync(localApi); } catch {}
  try { fs.unlinkSync(localStatic); } catch {}
  process.exit(1);
});
