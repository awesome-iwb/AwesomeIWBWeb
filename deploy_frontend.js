const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Step 1: Install frontend dependencies ==="`,
  `cd /opt/awesomeiwb/frontend && bun install 2>&1 | tail -10`,

  `echo "=== Step 2: Build frontend ==="`,
  `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -30`,

  `echo "=== Step 3: Check build output ==="`,
  `ls -la /opt/awesomeiwb/frontend/dist/ | head -25`,
  `ls -la /opt/awesomeiwb/frontend/dist/admin/ 2>/dev/null || echo "No admin dir in dist"`,

  `echo "=== Step 4: Deploy to nginx root ==="`,
  `rm -rf /var/www/awesomeiwb/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /var/www/awesomeiwb/dist/ && echo "Frontend deployed successfully"`,

  `echo "=== Step 5: Verify deployed files ==="`,
  `ls -la /var/www/awesomeiwb/dist/ | head -25`,
  `ls -la /var/www/awesomeiwb/dist/admin/ 2>/dev/null || echo "No admin dir"`,

  `echo "=== Step 6: Reload nginx ==="`,
  `nginx -t 2>&1 && nginx -s reload 2>&1 && echo "Nginx reloaded"`,

  `echo "=== Step 7: Test endpoints ==="`,
  `echo -n "Backend API: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/`,
  `echo ""`,
  `echo -n "Frontend: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/`,
  `echo ""`,
  `echo -n "Admin page: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/admin`,
  `echo ""`,
  `echo -n "Admin dashboard: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/admin/dashboard`,
  `echo ""`,
  `echo -n "API dashboard: " && curl -s http://127.0.0.1:8081/api/admin/dashboard 2>/dev/null | head -c 200`,
  `echo ""`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\n=== All done ==='); conn.end(); return; }
    const cmd = commands[idx];
    console.log(`\n>>> Running command ${idx + 1}/${commands.length}`);
    conn.exec(cmd, (err, stream) => {
      if (err) { console.error(`Error on cmd ${idx}:`, err.message); idx++; runNext(); return; }
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
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 60000 });
