const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `cd /opt/awesomeiwb && git fetch origin && git reset --hard origin/main`,
  `cd /opt/awesomeiwb/deploy && sed -i '/DATABASE_URL/d' docker-compose.yml`,
  `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -5`,
  `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Deployed"`,
  `echo -n "HTTPS /admin/dashboard: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/dashboard`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nDone'); conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error(`Error:`, err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 120000 });
