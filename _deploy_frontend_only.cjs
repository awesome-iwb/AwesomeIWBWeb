const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const PASS = fs.readFileSync(path.join(__dirname, '_deploy_tags_live.cjs'), 'utf8').match(/const PASS = '([^']+)'/)[1];
const OPENRESTY_DIST = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';
const WWW_DIST = '/var/www/awesomeiwb/dist';
const LOCAL = path.join(__dirname, 'frontend/src/lib/renderArticleContent.ts');
const REMOTE = '/opt/awesomeiwb/frontend/src/lib/renderArticleContent.ts';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', d => process.stdout.write(d));
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', code => resolve(code));
    });
  });
}
async function must(conn, cmd, label) {
  console.log('\n>>>', label);
  const code = await exec(conn, cmd);
  if (code !== 0) throw new Error('Failed: ' + label);
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
  console.log('Uploaded renderArticleContent.ts');

  await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build', 'frontend build');
  await must(conn, `mkdir -p ${WWW_DIST} ${OPENRESTY_DIST}`, 'mkdir dist');
  await must(conn, `rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${WWW_DIST}/ && rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${OPENRESTY_DIST}/`, 'rsync');

  const or = await exec(conn, "docker ps -a --filter name=1Panel-openresty --format '{{.Names}} {{.Status}}'");
  if (String(or).includes('Exited') || String(or).includes('Created')) {
    await must(conn, 'docker start 1Panel-openresty-zpMY 2>/dev/null || docker ps -a --filter name=openresty --format "{{.Names}}" | head -1 | xargs -r docker start', 'start openresty');
  }

  await exec(conn, [
    "docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -c \"select name from schema_migrations where name >= '0033' order by name;\"",
    "docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -c \"select to_regclass('public.article_links'), to_regclass('public.articles'), to_regclass('public.article_comments');\"",
    "curl -sS -o /dev/null -w 'health8081:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/health",
    "curl -sS -o /dev/null -w 'stories8081:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/admin/stories.html",
    "curl -sS -o /dev/null -w 'health443:%{http_code}\\n' https://aiwb.smart-teach.cn/api/health",
    "curl -sS -o /dev/null -w 'stories443:%{http_code}\\n' https://aiwb.smart-teach.cn/admin/stories.html",
    "docker ps --filter name=awesomeiwb-backend --format 'backend {{.Status}}'",
    "ls /var/www/awesomeiwb/dist/assets/*ArticleEdit* 2>/dev/null | head -3",
  ].join('\n'));

  conn.end();
  console.log('\nFRONTEND_DEPLOY_OK');
}
main().catch(e => { console.error(e); process.exit(1); });
