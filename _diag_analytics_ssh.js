const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
const cmds = [
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT tablename FROM pg_tables WHERE tablename IN ('page_views','click_events','search_queries');"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT * FROM schema_migrations WHERE name LIKE '%analytics%';"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT id FROM capabilities WHERE id = 'analytics:read';"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT count(*) AS page_views_count FROM page_views;"`,
  `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT u.name, uc.capability_id FROM users u JOIN user_capabilities uc ON u.id=uc.user_id WHERE uc.capability_id='analytics:read' LIMIT 10;"`,
  `ls -la /opt/awesomeiwb/dist/index.html 2>/dev/null; ls -la /var/www/awesomeiwb/dist/index.html 2>/dev/null; find /opt/awesomeiwb -name index.html -path '*/dist/*' 2>/dev/null | head -5`,
  `grep -r fetchAnalytics /opt/awesomeiwb/dist/assets/*.js 2>/dev/null | head -1 || echo NO_fetchAnalytics_in_dist`,
  `docker logs awesomeiwb-backend --tail 80 2>&1 | grep -i analytics || echo no_analytics_logs`,
];
function run(i) {
  if (i >= cmds.length) return;
  const conn = new Client();
  conn.on('ready', () => {
    console.log('\n=== CMD', i+1, '===');
    conn.exec(cmds[i], (err, stream) => {
      if (err) { console.error(err); conn.end(); run(i+1); return; }
      stream.on('data', d => process.stdout.write(d));
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', () => { conn.end(); run(i+1); });
    });
  }).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 25000 });
}
run(0);
