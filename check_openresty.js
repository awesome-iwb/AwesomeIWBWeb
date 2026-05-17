const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Full OpenResty config for aiwb ==="`,
  `docker exec 1Panel-openresty-zpMY cat /usr/local/openresty/nginx/conf/conf.d/aiwb.smart-teach.cn.conf 2>/dev/null`,
  `echo ""`,
  `echo "=== Proxy configs ==="`,
  `docker exec 1Panel-openresty-zpMY sh -c "for f in /www/sites/aiwb.smart-teach.cn/proxy/*.conf; do echo '---'; cat \$f; done" 2>/dev/null`,
  `echo ""`,
  `echo "=== Check /www/sites directory ==="`,
  `docker exec 1Panel-openresty-zpMY ls -la /www/sites/aiwb.smart-teach.cn/ 2>/dev/null`,
  `echo ""`,
  `echo "=== Check if there's an index dir ==="`,
  `docker exec 1Panel-openresty-zpMY ls -la /www/sites/aiwb.smart-teach.cn/index/ 2>/dev/null`,
  `echo ""`,
  `echo "=== Check OpenResty main nginx.conf ==="`,
  `docker exec 1Panel-openresty-zpMY cat /usr/local/openresty/nginx/conf/nginx.conf 2>/dev/null | head -80`,
  `echo ""`,
  `echo "=== Find all conf files ==="`,
  `docker exec 1Panel-openresty-zpMY find /usr/local/openresty/nginx/conf -name "*.conf" -type f 2>/dev/null`,
  `echo ""`,
  `echo "=== Check 1Panel site root ==="`,
  `docker exec 1Panel-openresty-zpMY sh -c "ls /www/sites/ 2>/dev/null"`,
  `echo ""`,
  `echo "=== Check host /www directory ==="`,
  `ls -la /www/ 2>/dev/null || echo "No /www on host"`,
  `find /www/sites/aiwb.smart-teach.cn/ -maxdepth 2 -type f 2>/dev/null | head -20`,
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
