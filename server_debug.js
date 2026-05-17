const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  'echo "=== docker-compose.yml ==="',
  'cat /opt/awesomeiwb/deploy/docker-compose.yml',
  'echo "=== backend.env ==="',
  'cat /etc/awesomeiwb/backend.env 2>/dev/null || echo "NOT FOUND"',
  'echo "=== .env in deploy ==="',
  'cat /opt/awesomeiwb/deploy/.env 2>/dev/null || echo "NOT FOUND"',
  'echo "=== PG container env ==="',
  'docker inspect awesomeiwb-pg --format "{{range .Config.Env}}{{println .}}{{end}}" 2>/dev/null',
  'echo "=== Backend container env ==="',
  'docker inspect awesomeiwb-backend --format "{{range .Config.Env}}{{println .}}{{end}}" 2>/dev/null',
  'echo "=== PG HBA conf ==="',
  'docker exec awesomeiwb-pg cat /var/lib/postgresql/data/pg_hba.conf 2>/dev/null | grep -v "^#" | grep -v "^$"',
  'echo "=== Test PG connection from backend network ==="',
  'docker exec awesomeiwb-backend env | grep -i database 2>/dev/null || echo "no DATABASE env"',
  'echo "=== Try psql from backend container ==="',
  'docker exec awesomeiwb-backend sh -c "echo test" 2>/dev/null || echo "container not running, cannot exec"',
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error(`Error on cmd ${idx}:`, err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
