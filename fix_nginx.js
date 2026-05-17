const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Check nginx status ==="`,
  `systemctl status nginx 2>&1 | head -15`,
  `echo "=== Restart nginx ==="`,
  `systemctl restart nginx 2>&1`,
  `systemctl status nginx 2>&1 | head -10`,
  `echo "=== Test frontend again ==="`,
  `echo -n "Frontend (8080): " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/`,
  `echo ""`,
  `echo -n "Admin page (8080): " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/admin`,
  `echo ""`,
  `echo -n "Admin dashboard (8080): " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/admin/dashboard`,
  `echo ""`,
  `echo -n "Backend API (8081): " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/`,
  `echo ""`,
  `echo -n "HTTPS frontend: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
  `echo ""`,
  `echo -n "HTTPS admin: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin`,
  `echo ""`,
  `echo -n "HTTPS admin dashboard: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/dashboard`,
  `echo ""`,
  `echo "=== Docker status ==="`,
  `docker ps --format "table {{.Names}}\\t{{.Status}}"`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\n=== Done ==='); conn.end(); return; }
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
