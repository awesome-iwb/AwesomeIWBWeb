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
    await must(conn, 'rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/');
    await must(conn, "docker exec 1Panel-openresty-zpMY sh -lc 'openresty -t && openresty -s reload'");

    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/me | sed -n '1,20p'");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/sw.js | sed -n '1,20p'");
    await must(conn, "curl -sSI 'https://aiwb.smart-teach.cn/api/auth/login?popup=1' | sed -n '1,20p'");

    console.log('\nDEPLOY_OK');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
