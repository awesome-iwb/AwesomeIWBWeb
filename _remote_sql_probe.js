const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
function run(cmd) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.exec(cmd, (e, s) => {
        if (e) return reject(e);
        let out = '', err = '';
        s.on('data', d => { out += d; });
        s.stderr.on('data', d => { err += d; });
        s.on('close', code => resolve({ code, out: out.toString(), err: err.toString() }));
      });
    }).on('error', reject).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 25000 });
  });
}
const sql = `
SELECT count(*) AS project_members_count FROM project_members;
SELECT count(*) AS projects_with_dev FROM projects WHERE developer_user_id IS NOT NULL;
SELECT count(*) AS approved_projects FROM projects WHERE status='approved';
SELECT count(*) AS approved_missing_pm FROM projects p
  WHERE p.status='approved' AND p.developer_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = p.developer_user_id);
SELECT id FROM capabilities WHERE id = 'dev:developer_manage';
SELECT status, count(*) FROM organizations GROUP BY status ORDER BY status;
SELECT p.id, p.slug FROM projects p WHERE p.status='approved' AND p.developer_user_id IS NOT NULL LIMIT 3;
`;
(async () => {
  const r1 = await run(`docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -v ON_ERROR_STOP=1 ${sql.split(';').filter(Boolean).map(q => `-c "${q.trim().replace(/"/g, '\\"')};"`).join(' ')}`);
  console.log('=== SQL ===\n', r1.out, r1.err);
})().catch(e => { console.error(e); process.exit(1); });
