const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';
const ROOT = path.resolve(__dirname);
const REMOTE = '/opt/awesomeiwb';
const OPENRESTY_DIST = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';
const WWW_DIST = '/var/www/awesomeiwb/dist';

const uploads = [
  { local: path.join(ROOT, 'backend/src'), remote: `${REMOTE}/backend/src`, dir: true },
  { local: path.join(ROOT, 'backend/migrations'), remote: `${REMOTE}/backend/migrations`, dir: true },
  { local: path.join(ROOT, 'backend/package.json'), remote: `${REMOTE}/backend/package.json`, dir: false },
  { local: path.join(ROOT, 'backend/bun.lock'), remote: `${REMOTE}/backend/bun.lock`, dir: false },
  { local: path.join(ROOT, 'frontend/src'), remote: `${REMOTE}/frontend/src`, dir: true },
  { local: path.join(ROOT, 'frontend/package.json'), remote: `${REMOTE}/frontend/package.json`, dir: false },
  { local: path.join(ROOT, 'frontend/package-lock.json'), remote: `${REMOTE}/frontend/package-lock.json`, dir: false },
  { local: path.join(ROOT, 'frontend/vite.config.ts'), remote: `${REMOTE}/frontend/vite.config.ts`, dir: false },
  { local: path.join(ROOT, 'frontend/tsconfig.json'), remote: `${REMOTE}/frontend/tsconfig.json`, dir: false },
  { local: path.join(ROOT, 'frontend/tsconfig.app.json'), remote: `${REMOTE}/frontend/tsconfig.app.json`, dir: false },
  { local: path.join(ROOT, 'frontend/components.json'), remote: `${REMOTE}/frontend/components.json`, dir: false },
];

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile()) out.push(full);
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
      stream.on('data', (d) => {
        stdout += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => {
        stderr += d.toString();
        process.stderr.write(d);
      });
      stream.on('close', (code) => resolve({ code, stdout, stderr }));
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
  await exec(conn, `mkdir -p "${dir}"`);
}

async function must(conn, cmd, label) {
  console.log(`\n>>> ${label || cmd}`);
  const out = await exec(conn, cmd);
  if (out.code !== 0) throw new Error(`Failed (${out.code}): ${label || cmd}\n${out.stderr}`);
  return out;
}

async function uploadAll(conn, sftp) {
  for (const item of uploads) {
    if (!item.dir) {
      await ensureDir(conn, item.remote);
      console.log(`file ${path.basename(item.local)}`);
      await put(sftp, item.local, item.remote);
      continue;
    }
    const files = walkFiles(item.local);
    console.log(`dir ${item.local} (${files.length} files)`);
    for (const f of files) {
      const rel = path.relative(item.local, f).replace(/\\/g, '/');
      const remote = `${item.remote}/${rel}`;
      await ensureDir(conn, remote);
      await put(sftp, f, remote);
    }
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
      readyTimeout: 120000,
      keepaliveInterval: 10000,
    });
  });
  console.log('Connected');

  try {
    if (!process.env.SKIP_UPLOAD) {
      const sftp = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
      await uploadAll(conn, sftp);
    } else {
      console.log('SKIP_UPLOAD=1, skipping file upload');
    }

    const deployDir = '/opt/awesomeiwb/deploy';
    const dockerCheck = await exec(conn, `docker ps --format '{{.Names}}' | grep -q awesomeiwb-backend && echo docker || echo systemd`);
    const useDocker = dockerCheck.stdout.includes('docker');

    if (useDocker) {
      await must(conn, `cd ${deployDir} && docker compose build backend`, 'docker build backend');
      await must(conn, `cd ${deployDir} && docker compose up -d backend`, 'docker up backend');
      await exec(conn, 'sleep 8');
      await must(conn, 'docker exec awesomeiwb-backend bun run migrate', 'migrate in container');
    } else {
      await must(
        conn,
        "bash -lc 'set -a; source /etc/awesomeiwb/backend.env 2>/dev/null || true; set +a; cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate'",
        'migrate on host'
      );
      await must(conn, 'systemctl restart awesomeiwb-backend', 'restart backend');
      await must(conn, 'systemctl is-active awesomeiwb-backend', 'backend active');
    }

    await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun install', 'frontend install');
    await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build', 'frontend build');

    await must(conn, `mkdir -p ${WWW_DIST} ${OPENRESTY_DIST}`, 'mkdir dist');
    await must(
      conn,
      `rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${WWW_DIST}/ && rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${OPENRESTY_DIST}/`,
      'rsync dist'
    );

    const tags = await exec(
      conn,
      "curl -sS -o /tmp/tags.json -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/tags || echo 000"
    );
    console.log('\n/api/tags http:', tags.stdout.trim());

    const health = await exec(
      conn,
      "curl -sS -o /dev/null -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/health || curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/api/health"
    );
    console.log('/api/health http:', health.stdout.trim());

    console.log('\nTAGS_DEPLOY_OK');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
