const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Verify admin HTML content ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin | head -5`,
  `echo ""`,
  `echo "=== Verify admin/dashboard HTML content ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin/dashboard | head -5`,
  `echo ""`,
  `echo "=== Verify API health ==="`,
  `curl -s http://127.0.0.1:8081/ | head -c 200`,
  `echo ""`,
  `echo "=== Verify admin API (should return 401) ==="`,
  `curl -s http://127.0.0.1:8081/api/admin/dashboard | head -c 200`,
  `echo ""`,
  `echo "=== Verify admin API through OpenResty ==="`,
  `curl -sk https://aiwb.smart-teach.cn/api/admin/dashboard | head -c 200`,
  `echo ""`,
  `echo "=== Check OpenResty proxy config ==="`,
  `docker exec 1Panel-openresty-zpMY cat /usr/local/openresty/nginx/conf/conf.d/aiwb.smart-teach.cn.conf 2>/dev/null | head -50`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { conn.end(); return; }
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
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
