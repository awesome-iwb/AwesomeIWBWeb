const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';

const ROOT = 'd:/github/AwesomeIWBWeb';
const REMOTE = '/opt/awesomeiwb';

const uploads = [
  { local: `${ROOT}/backend/src`, remote: `${REMOTE}/backend/src`, dir: true },
  { local: `${ROOT}/frontend/src`, remote: `${REMOTE}/frontend/src`, dir: true },
  { local: `${ROOT}/frontend/vite.config.ts`, remote: `${REMOTE}/frontend/vite.config.ts`, dir: false },
  { local: `${ROOT}/backend/migrations/0019_media_tags.sql`, remote: `${REMOTE}/backend/migrations/0019_media_tags.sql`, dir: false },
];

function posix(p) {
  return p.replace(/\\/g, '/');
}

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const ents = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of ents) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', d => (stdout += d.toString()));
      stream.stderr.on('data', d => (stderr += d.toString()));
      stream.on('close', code => resolve({ code, stdout, stderr, cmd }));
    });
  });
}

function put(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(local);
    const ws = sftp.createWriteStream(remote);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('close', resolve);
    rs.pipe(ws);
  });
}

async function ensureDir(conn, remoteFile) {
  const dir = remoteFile.split('/').slice(0, -1).join('/');
  const mk = await exec(conn, `mkdir -p ${dir}`);
  if (mk.code !== 0) throw new Error(`mkdir failed: ${dir}\n${mk.stderr}`);
}

async function must(conn, cmd) {
  const out = await exec(conn, cmd);
  process.stdout.write(`\n--- ${cmd} ---\n${out.stdout}${out.stderr}`);
  if (out.code !== 0) throw new Error(`Command failed (${out.code}): ${cmd}`);
  return out;
}

async function uploadAll(conn, sftp) {
  for (const item of uploads) {
    if (!item.dir) {
      const local = posix(item.local);
      const remote = posix(item.remote);
      process.stdout.write(`Uploading file ${local} -> ${remote}\n`);
      await ensureDir(conn, remote);
      await put(sftp, local, remote);
      continue;
    }

    const localRoot = posix(item.local);
    const remoteRoot = posix(item.remote);
    const files = walkFiles(localRoot);
    for (const f of files) {
      const rel = posix(path.relative(localRoot, f));
      const remote = `${remoteRoot}/${rel}`;
      await ensureDir(conn, remote);
      await put(sftp, posix(f), remote);
    }
    process.stdout.write(`Uploaded directory ${localRoot} (${files.length} files)\n`);
  }
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

    await uploadAll(conn, sftp);

    await must(conn, 'rm -f /opt/awesomeiwb/frontend/src/views/AdminView.vue');
    await must(conn, 'bash /opt/awesomeiwb/deploy/backup-db.sh');
    await must(conn, "bash -lc 'set -a; . /etc/awesomeiwb/backend.env; set +a; cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate'");
    await must(conn, 'systemctl restart awesomeiwb-backend');
    await must(conn, 'systemctl is-active awesomeiwb-backend');
    await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build');
    await must(conn, 'mkdir -p /var/www/awesomeiwb/dist /www/sites/aiwb.smart-teach.cn/dist');
    await must(conn, 'rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/');
    await must(conn, 'rsync -a --delete /opt/awesomeiwb/frontend/dist/ /www/sites/aiwb.smart-teach.cn/dist/');
    await must(conn, "docker exec 1Panel-openresty-zpMY sh -lc 'openresty -t && openresty -s reload'");

    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/api/healthz | sed -n '1,20p' || true");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/api/admin/dashboard | sed -n '1,20p' || true");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/me | sed -n '1,20p'");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/admin | sed -n '1,20p'");

    console.log('\nLOCAL_UPLOAD_DEPLOY_OK');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
