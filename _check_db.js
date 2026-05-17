const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', async () => {
  function execCmd(cmd) {
    return new Promise((resolve) => {
      conn.exec(cmd, (err, stream) => {
        if (err) { console.error('Error:', err.message); resolve(''); return; }
        let out = '';
        stream.on('data', (data) => { out += data.toString(); process.stdout.write(data.toString()); });
        stream.stderr.on('data', (data) => { out += data.toString(); process.stdout.write('[STDERR] ' + data.toString()); });
        stream.on('close', () => resolve(out));
      });
    });
  }

  console.log('\n=== Check Docker containers ===');
  await execCmd('docker ps --format "{{.Names}}\t{{.Ports}}\t{{.Status}}" 2>&1');

  console.log('\n=== Check PostgreSQL running ===');
  await execCmd('ss -tlnp | grep 5432');

  console.log('\n=== Check docker-compose for postgres ===');
  await execCmd('cat /opt/awesomeiwb/deploy/docker-compose.db.yml 2>/dev/null || echo "NOT FOUND"');

  console.log('\n=== Check docker-compose main ===');
  await execCmd('cat /opt/awesomeiwb/deploy/docker-compose.yml 2>/dev/null | head -50 || echo "NOT FOUND"');

  console.log('\n=== Check /etc/hosts for postgres ===');
  await execCmd('grep postgres /etc/hosts || echo "No postgres entry in /etc/hosts"');

  console.log('\n=== Try connecting to localhost:5432 ===');
  await execCmd('timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/5432" 2>&1 && echo "Port 5432 OPEN" || echo "Port 5432 CLOSED"');

  console.log('\n=== Check Docker network ===');
  await execCmd('docker network ls 2>&1');
  await execCmd('docker inspect --format="{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" $(docker ps -q) 2>&1 | head -10');

  conn.end();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
