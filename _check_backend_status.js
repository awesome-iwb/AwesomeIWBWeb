const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', async () => {
  console.log('SSH connected!');

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

  console.log('\n=== Check DATABASE_URL ===');
  await execCmd('grep DATABASE_URL /etc/awesomeiwb/backend.env');

  console.log('\n=== Check service status ===');
  await execCmd('systemctl status awesomeiwb-backend --no-pager -l 2>&1 | head -30');

  console.log('\n=== Check recent error logs ===');
  await execCmd('tail -30 /var/log/awesomeiwb/backend.err.log 2>/dev/null');

  console.log('\n=== Check recent stdout logs ===');
  await execCmd('tail -30 /var/log/awesomeiwb/backend.log 2>/dev/null');

  console.log('\n=== Try restart again ===');
  await execCmd('systemctl restart awesomeiwb-backend');
  await new Promise(r => setTimeout(r, 5000));
  await execCmd('systemctl is-active awesomeiwb-backend');

  console.log('\n=== Test API ===');
  await execCmd('curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects');
  console.log('');
  await execCmd('curl -sk https://aiwb.smart-teach.cn/api/auth/login 2>&1 | head -c 500');

  conn.end();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
