const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Step 1: Pull latest code ==="`,
  `cd /opt/awesomeiwb && git fetch origin && git reset --hard origin/main && git log --oneline -3`,

  `echo "=== Step 2: Rebuild backend Docker ==="`,
  `cd /opt/awesomeiwb/deploy && docker compose build backend 2>&1 | tail -10`,

  `echo "=== Step 3: Restart backend ==="`,
  `cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1`,
  `sleep 5`,
  `docker ps --format "table {{.Names}}\\t{{.Status}}" | grep backend`,

  `echo "=== Step 4: Check backend logs ==="`,
  `cd /opt/awesomeiwb/deploy && docker compose logs backend --tail=10 2>/dev/null`,

  `echo "=== Step 5: Build frontend ==="`,
  `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -10`,

  `echo "=== Step 6: Deploy frontend to OpenResty ==="`,
  `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/*`,
  `cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/`,
  `echo "Frontend deployed"`,

  `echo "=== Step 7: Verify ==="`,
  `echo -n "Backend API: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/`,
  `echo ""`,
  `echo -n "HTTPS admin: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin`,
  `echo ""`,
  `echo -n "HTTPS admin/dashboard: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/dashboard`,
  `echo ""`,
  `echo "=== Dashboard API test (with auth) ==="`,
  `curl -s http://127.0.0.1:8081/api/admin/dashboard 2>/dev/null | head -c 300`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\n=== All done ==='); conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error(`Error:`, err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
      stream.on('close', (code) => {
        console.log(`\n[Exit code: ${code}]`);
        idx++;
        runNext();
      });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 120000 });
