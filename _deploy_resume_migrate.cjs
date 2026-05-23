const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const PASS = fs.readFileSync(path.join(__dirname, '_deploy_tags_live.cjs'), 'utf8').match(/const PASS = '([^']+)'/)[1];
const REMOTE = '/opt/awesomeiwb/backend/migrations/0042_notification_types_expand.sql';
const LOCAL = path.join(__dirname, 'backend/migrations/0042_notification_types_expand.sql');
const OPENRESTY_DIST = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';
const WWW_DIST = '/var/www/awesomeiwb/dist';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', d => { stdout += d; process.stdout.write(d); });
      stream.stderr.on('data', d => { stderr += d; process.stderr.write(d); });
      stream.on('close', code => resolve({ code, stdout, stderr }));
    });
  });
}
async function must(conn, cmd, label) {
  console.log('\n>>>', label || cmd);
  const out = await exec(conn, cmd);
  if (out.code !== 0) throw new Error(`Failed: ${label}\n${out.stderr}`);
  return out;
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect({ host: '210.16.165.251', port: 22, username: 'root', password: PASS, readyTimeout: 120000 }));
  const sftp = await new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));
  await new Promise((res, rej) => {
    const rs = fs.createReadStream(LOCAL);
    const ws = sftp.createWriteStream(REMOTE);
    rs.on('error', rej); ws.on('error', rej); ws.on('close', res);
    rs.pipe(ws);
  });
  console.log('Uploaded 0042 migration');

  await must(conn, 'docker exec awesomeiwb-backend bun run migrate', 'migrate');
  await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun install', 'frontend install');
  await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build', 'frontend build');
  await must(conn, `mkdir -p ${WWW_DIST} ${OPENRESTY_DIST}`, 'mkdir dist');
  await must(conn, `rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${WWW_DIST}/ && rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${OPENRESTY_DIST}/`, 'rsync dist');

  const mig = await exec(conn, `docker exec awesomeiwb-backend bun -e "import { sql } from './src/db/client.ts'; const rows = await sql()\`select name from schema_migrations order by name\`; console.log(JSON.stringify(rows.map(r=>r.name)));"`);
  console.log('migrations tail:', mig.stdout.slice(-500));

  const checks = [
    "curl -sS -o /dev/null -w 'health:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/health",
    "curl -sS -o /dev/null -w 'stories:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/admin/stories.html",
    "docker ps --filter name=awesomeiwb-backend --format '{{.Names}} {{.Status}}'",
    "docker ps --filter name=openresty --format '{{.Names}} {{.Status}}'",
    "grep -l ArticleEditView /opt/awesomeiwb/frontend/dist/assets/*.js 2>/dev/null | head -1 || ls /opt/awesomeiwb/frontend/dist/assets/*Article* 2>/dev/null | head -3",
  ].join('; ');
  await exec(conn, checks);

  conn.end();
  console.log('\nRESUME_DEPLOY_OK');
}
main().catch(e => { console.error(e); process.exit(1); });
