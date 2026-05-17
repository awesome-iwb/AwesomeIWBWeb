const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', async () => {
  function execCmd(cmd, timeout = 30000) {
    return new Promise((resolve) => {
      console.log(`\n>>> ${cmd.substring(0, 120)}...`);
      conn.exec(cmd, (err, stream) => {
        if (err) { console.error('Error:', err.message); resolve(''); return; }
        let out = '';
        stream.on('data', (data) => { out += data.toString(); process.stdout.write(data.toString()); });
        stream.stderr.on('data', (data) => { out += data.toString(); process.stdout.write('[STDERR] ' + data.toString()); });
        stream.on('close', () => resolve(out));
      });
    });
  }

  console.log('\n=== Step 1: Stop systemd service (it conflicts with Docker) ===');
  await execCmd('systemctl stop awesomeiwb-backend 2>/dev/null; systemctl disable awesomeiwb-backend 2>/dev/null; echo "Systemd service stopped"');

  console.log('\n=== Step 2: Check current Docker backend container ===');
  await execCmd('docker ps --filter name=awesomeiwb-backend --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"');

  console.log('\n=== Step 3: Check Dockerfile ===');
  await execCmd('cat /opt/awesomeiwb/backend/Dockerfile');

  console.log('\n=== Step 4: Rebuild Docker backend image with new code ===');
  await execCmd('cd /opt/awesomeiwb/deploy && docker compose build backend 2>&1 | tail -20', 120000);

  console.log('\n=== Step 5: Restart Docker backend container ===');
  await execCmd('cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1');

  console.log('\n=== Step 6: Wait for container to be healthy ===');
  await new Promise(r => setTimeout(r, 10000));
  await execCmd('docker ps --filter name=awesomeiwb-backend --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"');

  console.log('\n=== Step 7: Check container logs ===');
  await execCmd('docker logs awesomeiwb-backend --tail 20 2>&1');

  console.log('\n=== Step 8: Verify API ===');
  await execCmd('echo -n "API /api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects');
  console.log('');
  await execCmd('echo -n "API /api/auth/login: " && curl -sk https://aiwb.smart-teach.cn/api/auth/login 2>&1 | head -c 500');
  console.log('');
  await execCmd('echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/');

  conn.end();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
