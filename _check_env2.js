const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const commands = [
    `cat /etc/systemd/system/awesomeiwb-backend.service 2>&1`,
    `cat /opt/awesomeiwb/deploy/docker-compose.yml 2>&1 | head -60`,
    `ls -la /opt/awesomeiwb/backend/backend.env /opt/awesomeiwb/backend/.env /opt/awesomeiwb/deploy/backend.env 2>&1`,
    `systemctl show awesomeiwb-backend -p Environment -p EnvironmentFiles 2>&1`,
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
