const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== static.conf ==="`,
  `cat /www/sites/aiwb.smart-teach.cn/proxy/static.conf`,
  `echo ""`,
  `echo "=== api.conf ==="`,
  `cat /www/sites/aiwb.smart-teach.cn/proxy/api.conf`,
  `echo ""`,
  `echo "=== Check current dist content ==="`,
  `ls -la /www/sites/aiwb.smart-teach.cn/dist/ | head -30`,
  `echo ""`,
  `echo "=== Check admin dir in old dist ==="`,
  `ls -la /www/sites/aiwb.smart-teach.cn/dist/admin/ 2>/dev/null || echo "No admin dir"`,
  `echo ""`,
  `echo "=== Check assets in old dist ==="`,
  `ls -la /www/sites/aiwb.smart-teach.cn/dist/assets/ | head -20`,
  `echo ""`,
  `echo "=== Check SSL config ==="`,
  `ls -la /www/sites/aiwb.smart-teach.cn/ssl/ 2>/dev/null`,
  `cat /www/sites/aiwb.smart-teach.cn/ssl/*.conf 2>/dev/null || echo "No SSL conf"`,
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
