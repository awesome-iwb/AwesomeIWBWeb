const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const commands = [
    `echo "=== systemd backend status ===" && systemctl is-active awesomeiwb-backend 2>&1`,
    `echo "=== docker backend status ===" && docker ps --filter name=awesomeiwb-backend --format "{{.Status}}" 2>&1`,
    `echo "=== port 8080 ===" && ss -tlnp | grep 8080 2>&1`,
    `echo "=== port 8081 ===" && ss -tlnp | grep 8081 2>&1`,
    `echo "=== openresty upstream ===" && grep -r "8080\\|8081" /opt/1panel/apps/openresty/openresty/conf/conf.d/ 2>&1 | head -10`,
  ];
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nDone!'); conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error('Error:', err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write(''));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
