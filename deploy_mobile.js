const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Step 1: Pull latest code ==="`,
  `cd /opt/awesomeiwb && git fetch origin && git reset --hard origin/main && git log --oneline -2`,

  `echo "=== Step 2: Fix docker-compose DATABASE_URL (if restored by git) ==="`,
  `cd /opt/awesomeiwb/deploy && sed -i '/DATABASE_URL/d' docker-compose.yml`,
  `grep -c "DATABASE_URL" docker-compose.yml || echo "No DATABASE_URL (good)"`,

  `echo "=== Step 3: Rebuild backend ==="`,
  `cd /opt/awesomeiwb/deploy && docker compose build backend 2>&1 | tail -5`,
  `cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1`,

  `echo "=== Step 4: Build frontend ==="`,
  `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -10`,

  `echo "=== Step 5: Deploy frontend ==="`,
  `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/*`,
  `cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/`,
  `echo "Deployed"`,

  `echo "=== Step 6: Verify ==="`,
  `sleep 5`,
  `echo -n "Backend: " && docker ps --format "{{.Names}}: {{.Status}}" | grep backend`,
  `echo -n "HTTPS /admin: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin`,
  `echo ""`,
  `echo -n "HTTPS /admin/dashboard: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/dashboard`,
  `echo ""`,
  `echo "=== Check new JS bundle has LazySection ==="`,
  `grep -l "LazySection\\|scrollbar-hide\\|grid-cols-5" /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/assets/*.js 2>/dev/null | head -3`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\n=== Done ==='); conn.end(); return; }
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
