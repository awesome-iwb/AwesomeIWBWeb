const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Step 1: Fix static.conf try_files order ==="`,
  `cat > /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf << 'EOF'
location / {
    root /www/sites/aiwb.smart-teach.cn/dist;
    index index.html;
    try_files $uri $uri.html $uri/ /index.html;
}

location ~* \\.(js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$ {
    root /www/sites/aiwb.smart-teach.cn/dist;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
EOF`,
  `echo "Config updated"`,
  `cat /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf`,

  `echo "=== Step 2: Reload OpenResty ==="`,
  `docker exec 1Panel-openresty-zpMY nginx -t 2>&1`,
  `docker exec 1Panel-openresty-zpMY nginx -s reload 2>&1`,
  `echo "Reloaded"`,

  `echo "=== Step 3: Test all admin routes ==="`,
  `echo -n "HTTPS /admin: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin`,
  `echo ""`,
  `echo -n "HTTPS /admin/dashboard: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/dashboard`,
  `echo ""`,
  `echo -n "HTTPS /admin/users: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/users`,
  `echo ""`,
  `echo -n "HTTPS /admin/media: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/media`,
  `echo ""`,
  `echo -n "HTTPS /admin/stories: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/stories`,
  `echo ""`,

  `echo "=== Step 4: Verify admin.html has sidebar ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin 2>/dev/null | grep -o 'hidden lg:flex flex-col w-56\\|Awesome.*后台\\|AdminSidebar\\|admin-sidebar' | head -5`,

  `echo "=== Step 5: Verify dashboard.html has dashboard cards ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin/dashboard 2>/dev/null | grep -o 'DashboardCard\\|grid-cols-2 lg:grid-cols-4\\|项目总数\\|总览' | head -5`,

  `echo "=== Step 6: Check JS bundle contains new code ==="`,
  `curl -sk https://aiwb.smart-teach.cn/assets/app-C9l23V0H.js 2>/dev/null | grep -o 'AdminSidebar\\|AdminLayout\\|AdminBottomNav\\|DashboardView' | head -5`,

  `echo "=== Step 7: Full page content check ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin 2>/dev/null | head -c 2000`,
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
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
