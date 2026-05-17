const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
const sql = `INSERT INTO user_capabilities (user_id, capability_id)
SELECT uc.user_id, 'analytics:read'
FROM user_capabilities uc
WHERE uc.capability_id = 'admin_panel_access'
ON CONFLICT (user_id, capability_id) DO NOTHING;`;
const cmd = `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "${sql.replace(/"/g, '\\"')}"`;
const c = new Client();
c.on('ready', () => {
  c.exec(cmd, (err, s) => {
    s.on('data', d => process.stdout.write(d));
    s.stderr.on('data', d => process.stderr.write(d));
    s.on('close', () => c.end());
  });
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass });
