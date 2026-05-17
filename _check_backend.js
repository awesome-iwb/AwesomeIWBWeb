const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', async () => {
  function execCmd(cmd, label) {
    return new Promise((resolve) => {
      console.log(`\n>>> ${label || cmd.substring(0, 100)}`);
      conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); resolve(''); return; }
        stream.on('data', (data) => process.stdout.write(data.toString()));
        stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
        stream.on('close', () => resolve(''));
      });
    });
  }

  console.log('\n=== Check backend container logs ===');
  await execCmd('docker logs awesomeiwb-backend --tail 30 2>&1', 'Backend logs');

  console.log('\n=== Check docker-compose env ===');
  await execCmd('cat /opt/awesomeiwb/deploy/docker-compose.yml 2>&1 | head -60', 'Docker compose config');

  console.log('\n=== Check backend.env ===');
  await execCmd('cat /etc/awesomeiwb/backend.env 2>&1 | head -20', 'Backend env');

  conn.end();
});

conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
