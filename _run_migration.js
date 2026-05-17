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

  console.log('\n=== Check which migrations already applied ===');
  await execCmd('docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT * FROM schema_migrations ORDER BY version;" 2>&1', 'Check applied migrations');

  console.log('\n=== Try running migration inside Docker container ===');
  await execCmd('docker exec awesomeiwb-backend bun run src/scripts/migrate.ts 2>&1', 'Run migration in container', 60000);

  console.log('\n=== Check backend container status after migration ===');
  await execCmd('docker ps --filter name=awesomeiwb-backend --format "{{.Names}}\t{{.Status}}"', 'Check status');

  conn.end();
});

conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
