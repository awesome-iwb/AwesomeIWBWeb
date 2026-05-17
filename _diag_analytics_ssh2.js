const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
const cmds = [
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "\\d schema_migrations"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT * FROM schema_migrations ORDER BY 1 DESC LIMIT 15;"`,
  `grep -l '数据分析' /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -3; grep -l 'analytics:read' /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -3; grep -l 'LazySection' /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -3`,
  `grep -o 'DashboardView[^"]*' /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -5`,
  `ls -lt /var/www/awesomeiwb/dist/assets/*.js | head -5`,
  `grep -r 'admin/analytics' /opt/awesomeiwb/backend/dist 2>/dev/null | head -3 || grep -r analytics /opt/awesomeiwb/backend/src 2>/dev/null | head -5`,
];
let i = 0;
function next() {
  if (i >= cmds.length) return;
  const conn = new Client();
  conn.on('ready', () => {
    console.log('\n===', i+1, '===');
    conn.exec(cmds[i++], (err, stream) => {
      stream.on('data', d => process.stdout.write(d));
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', () => { conn.end(); next(); });
    });
  }).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass });
}
next();
