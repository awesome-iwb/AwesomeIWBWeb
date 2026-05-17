const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
function sshExec(cmd) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.exec(cmd, { pty: false }, (e, s) => {
        if (e) return reject(e);
        let out = '', err = '';
        s.on('data', d => { out += d; });
        s.stderr.on('data', d => { err += d; });
        s.on('close', code => resolve({ code, out, err }));
      });
    }).on('error', reject).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 25000 });
  });
}
async function main() {
  const sections = [];
  const run = async (title, cmd) => {
    const r = await sshExec(cmd);
    sections.push(`\n=== ${title} (exit ${r.code}) ===\n${r.out}${r.err ? '\nSTDERR:\n' + r.err : ''}`);
    return r;
  };

  await run('SQL STATS', `bash -lc 'docker exec -i awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb' <<'EOSQL'
\\echo --- counts ---
SELECT count(*) AS project_members_count FROM project_members;
SELECT count(*) AS projects_with_dev FROM projects WHERE developer_user_id IS NOT NULL;
SELECT count(*) AS approved_projects FROM projects WHERE status='approved';
SELECT count(*) AS approved_missing_pm FROM projects p
  WHERE p.status='approved' AND p.developer_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = p.developer_user_id);
\\echo --- capability ---
SELECT id, name FROM capabilities WHERE id = 'dev:developer_manage';
\\echo --- org status ---
SELECT status, count(*) FROM organizations GROUP BY status ORDER BY status;
\\echo --- sample projects ---
SELECT id, slug, developer_user_id FROM projects WHERE developer_user_id IS NOT NULL LIMIT 5;
\\echo --- pm sample ---
SELECT project_id, user_id, role FROM project_members LIMIT 10;
EOSQL`);

  const samplePid = await run('GET SAMPLE PROJECT ID', `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -A -c "SELECT id FROM projects ORDER BY id LIMIT 1"`);
  const pid = samplePid.out.trim();
  const sampleDev = await run('GET SAMPLE DEV USER', `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -A -c "SELECT developer_user_id FROM projects WHERE developer_user_id IS NOT NULL LIMIT 1"`);
  const devId = sampleDev.out.trim();
  const sampleUser = await run('GET PUBLIC USER', `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -A -c "SELECT id FROM users ORDER BY id LIMIT 1"`);
  const userId = sampleUser.out.trim();

  await run('API ROUTES GREP', `grep -nE "members|developers|getUserPublicProjects" /opt/awesomeiwb/backend/src/index.ts 2>/dev/null | head -40 || docker exec awesomeiwb-backend sh -c "grep -rn members /app/dist 2>/dev/null | head -20"`);

  const endpoints = [
    ['GET admin members', `curl -sS -o /tmp/r.txt -w "%{http_code}" http://127.0.0.1:8081/api/admin/projects/${pid}/members`],
    ['GET admin developer', `curl -sS -o /tmp/r.txt -w "%{http_code}" http://127.0.0.1:8081/api/admin/developers/${devId}`],
    ['PATCH dev member', `curl -sS -o /tmp/r.txt -w "%{http_code}" -X PATCH http://127.0.0.1:8081/api/dev/projects/${pid}/members/${userId} -H "Content-Type: application/json" -d "{}"`],
    ['GET public user projects', `curl -sS -o /tmp/r.txt -w "%{http_code}" http://127.0.0.1:8081/api/users/${userId}/projects`],
    ['GET dev orgs', `curl -sS -o /tmp/r.txt -w "%{http_code}" http://127.0.0.1:8081/api/dev/organizations`],
  ];
  for (const [name, curl] of endpoints) {
    const r = await run(`API ${name}`, `${curl}; echo; head -c 400 /tmp/r.txt; echo`);
  }

  await run('BACKEND LOGS', `docker logs awesomeiwb-backend --tail 80 2>&1`);
  await run('PG LOGS', `docker logs awesomeiwb-pg --tail 30 2>&1`);
  await run('NGINX CONF', `grep -r "awesomeiwb" /opt/1panel/apps/openresty/openresty/conf 2>/dev/null | head -25; ls /var/www/awesomeiwb 2>/dev/null; cat /opt/awesomeiwb/deploy/openresty*.conf 2>/dev/null | head -40`);

  console.log(sections.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
