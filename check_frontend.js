const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Check frontend deployment ==="`,
  `ls -la /opt/awesomeiwb/frontend/dist/ 2>/dev/null || echo "No dist dir"`,
  `echo "=== Check nginx config ==="`,
  `cat /etc/nginx/sites-enabled/awesomeiwb 2>/dev/null || cat /etc/nginx/conf.d/awesomeiwb.conf 2>/dev/null || echo "Checking other locations..."`,
  `find /etc/nginx -name "*awesome*" -o -name "*iwb*" -o -name "*smart*" 2>/dev/null`,
  `echo "=== Check openresty config ==="`,
  `find /usr/local/openresty -name "*.conf" 2>/dev/null | head -10`,
  `docker exec 1Panel-openresty-zpMY find /usr/local/openresty/nginx/conf -name "*.conf" 2>/dev/null | head -20`,
  `echo "=== Check 1Panel sites ==="`,
  `docker exec 1Panel-openresty-zpMY ls /usr/local/openresty/nginx/conf/conf.d/ 2>/dev/null`,
  `echo "=== Find the site config ==="`,
  `docker exec 1Panel-openresty-zpMY cat /usr/local/openresty/nginx/conf/conf.d/default.conf 2>/dev/null | head -50`,
  `echo "=== Check all conf.d files ==="`,
  `docker exec 1Panel-openresty-zpMY sh -c "for f in /usr/local/openresty/nginx/conf/conf.d/*.conf; do echo '---'; echo \$f; cat \$f | head -30; done" 2>/dev/null`,
  `echo "=== Check where frontend files are served from ==="`,
  `ls -la /opt/awesomeiwb/frontend/ 2>/dev/null | head -20`,
  `echo "=== Check node on server ==="`,
  `which node 2>/dev/null; node --version 2>/dev/null; which npm 2>/dev/null; npm --version 2>/dev/null`,
  `echo "=== Check bun on server ==="`,
  `which bun 2>/dev/null; bun --version 2>/dev/null`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error(`Error on cmd ${idx}:`, err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
