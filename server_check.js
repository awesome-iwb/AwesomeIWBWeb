const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'echo "=== Docker Status ==="',
  'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
  'echo "=== Backend Logs (last 20) ==="',
  'cd /opt/awesomeiwb/deploy && docker compose logs backend --tail=20 2>/dev/null',
  'echo "=== Git Status ==="',
  'cd /opt/awesomeiwb && git log --oneline -3',
  'echo "=== Current Branch ==="',
  'cd /opt/awesomeiwb && git branch -a',
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let output = '';
  let idx = 0;

  function runNext() {
    if (idx >= commands.length) {
      console.log('\n--- Full Output ---');
      console.log(output);
      conn.end();
      return;
    }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { output += `Error: ${err.message}\n`; idx++; runNext(); return; }
      let chunk = '';
      stream.on('data', (data) => { chunk += data.toString(); process.stdout.write(data.toString()); });
      stream.on('close', () => { output += chunk + '\n'; idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => { console.error('SSH Error:', err.message); });

conn.connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 15000,
});
