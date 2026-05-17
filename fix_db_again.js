const { Client } = require('ssh2');
const conn = new Client();

const PG_PASSWORD = 'cd316733db8145bc149e54cfdeb843cabb439219146f5a1f';

const commands = [
  `echo "=== Check backend.env ==="`,
  `grep DATABASE_URL /etc/awesomeiwb/backend.env`,

  `echo "=== Check docker-compose.yml for DATABASE_URL ==="`,
  `cat /opt/awesomeiwb/deploy/docker-compose.yml`,

  `echo "=== Fix: Remove DATABASE_URL from docker-compose environment block ==="`,
  `cd /opt/awesomeiwb/deploy && sed -i '/DATABASE_URL/d' docker-compose.yml`,
  `cat docker-compose.yml`,

  `echo "=== Ensure backend.env has correct DATABASE_URL ==="`,
  `grep DATABASE_URL /etc/awesomeiwb/backend.env`,
  `sed -i 's|DATABASE_URL=postgres://awesomeiwb:awesomeiwb@postgres:5432/awesomeiwb|DATABASE_URL=postgres://awesomeiwb:${PG_PASSWORD}@postgres:5432/awesomeiwb|' /etc/awesomeiwb/backend.env`,
  `grep DATABASE_URL /etc/awesomeiwb/backend.env`,

  `echo "=== Restart backend ==="`,
  `cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1`,
  `sleep 8`,
  `docker ps --format "table {{.Names}}\\t{{.Status}}" | grep backend`,

  `echo "=== Check backend logs ==="`,
  `cd /opt/awesomeiwb/deploy && docker compose logs backend --tail=15 2>/dev/null`,

  `echo "=== Test API ==="`,
  `curl -s http://127.0.0.1:8081/ | head -c 100`,
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
      stream.on('close', (code) => {
        console.log(`\n[Exit code: ${code}]`);
        idx++;
        runNext();
      });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 30000 });
