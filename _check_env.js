const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec(`cd /opt/awesomeiwb/backend && cat backend.env 2>/dev/null | grep -i "CASDOOR\\|FRONTEND_URL\\|REDIRECT\\|PUBLIC_BASE" && echo "---" && cat /opt/awesomeiwb/deploy/docker-compose.yml 2>/dev/null | grep -A2 "CASDOOR\\|FRONTEND_URL\\|REDIRECT\\|PUBLIC_BASE"`, (err, stream) => {
    if (err) { console.error('Error:', err.message); conn.end(); return; }
    stream.on('data', (data) => process.stdout.write(data.toString()));
    stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
    stream.on('close', () => { conn.end(); });
  });
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
