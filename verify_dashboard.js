const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Check docker-compose.yml ==="`,
  `grep -n "DATABASE_URL" /opt/awesomeiwb/deploy/docker-compose.yml || echo "No DATABASE_URL in docker-compose.yml (good!)"`,
  `cat /opt/awesomeiwb/deploy/docker-compose.yml | head -40`,

  `echo "=== Test dashboard API ==="`,
  `curl -s http://127.0.0.1:8081/api/admin/dashboard 2>/dev/null | head -c 500`,

  `echo ""`,
  `echo "=== Test HTTPS dashboard ==="`,
  `curl -sk https://aiwb.smart-teach.cn/api/admin/dashboard 2>/dev/null | head -c 500`,

  `echo ""`,
  `echo "=== Verify frontend files ==="`,
  `ls -la /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/assets/DashboardView* 2>/dev/null`,
  `ls -la /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/admin/dashboard.html 2>/dev/null`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error(`Error:`, err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
