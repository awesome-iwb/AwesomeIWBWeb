const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== OpenResty container volume mounts ==="`,
  `docker inspect 1Panel-openresty-zpMY --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\\n"}}{{end}}' 2>/dev/null`,
  `echo ""`,
  `echo "=== Check if /var/www/awesomeiwb/dist exists inside container ==="`,
  `docker exec 1Panel-openresty-zpMY ls -la /var/www/awesomeiwb/dist/ 2>/dev/null | head -20`,
  `echo ""`,
  `echo "=== Check admin.html inside container ==="`,
  `docker exec 1Panel-openresty-zpMY head -1 /var/www/awesomeiwb/dist/admin.html 2>/dev/null | head -c 500`,
  `echo ""`,
  `echo "=== Check assets inside container ==="`,
  `docker exec 1Panel-openresty-zpMY ls /var/www/awesomeiwb/dist/assets/ 2>/dev/null | head -20`,
  `echo ""`,
  `echo "=== Compare file sizes between host dirs ==="`,
  `echo "--- /var/www/awesomeiwb/dist/admin.html ---"`,
  `ls -la /var/www/awesomeiwb/dist/admin.html`,
  `echo "--- /www/sites/aiwb.smart-teach.cn/dist/admin.html ---"`,
  `ls -la /www/sites/aiwb.smart-teach.cn/dist/admin.html`,
  `echo ""`,
  `echo "=== Check if /var/www is mounted ==="`,
  `docker exec 1Panel-openresty-zpMY sh -c "mount | grep '/var/www'" 2>/dev/null || echo "not mounted"`,
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
