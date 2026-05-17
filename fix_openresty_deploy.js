const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Step 1: Find the actual host path for OpenResty www ==="`,
  `ls -la /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ 2>/dev/null | head -10`,
  `echo ""`,
  `echo "=== Step 2: Check if /www is a symlink ==="`,
  `ls -la /www 2>/dev/null`,
  `readlink -f /www/sites/aiwb.smart-teach.cn/dist/ 2>/dev/null`,
  `echo ""`,
  `echo "=== Step 3: Copy new frontend files to OpenResty-accessible path ==="`,
  `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/*`,
  `cp -r /var/www/awesomeiwb/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/`,
  `echo "Copy done"`,
  `echo ""`,
  `echo "=== Step 4: Update static.conf to use /www path ==="`,
  `cat > /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf << 'EOF'
location / {
    root /www/sites/aiwb.smart-teach.cn/dist;
    index index.html;
    try_files $uri $uri/ $uri.html /index.html;
}

location ~* \\.(js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$ {
    root /www/sites/aiwb.smart-teach.cn/dist;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
EOF`,
  `echo "Config updated"`,
  `cat /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf`,
  `echo ""`,
  `echo "=== Step 5: Verify files in container ==="`,
  `docker exec 1Panel-openresty-zpMY ls -la /www/sites/aiwb.smart-teach.cn/dist/ 2>/dev/null | head -20`,
  `docker exec 1Panel-openresty-zpMY ls /www/sites/aiwb.smart-teach.cn/dist/admin/ 2>/dev/null`,
  `docker exec 1Panel-openresty-zpMY ls /www/sites/aiwb.smart-teach.cn/dist/assets/ 2>/dev/null | head -15`,
  `echo ""`,
  `echo "=== Step 6: Reload OpenResty ==="`,
  `docker exec 1Panel-openresty-zpMY nginx -t 2>&1`,
  `docker exec 1Panel-openresty-zpMY nginx -s reload 2>&1`,
  `echo "OpenResty reloaded"`,
  `echo ""`,
  `echo "=== Step 7: Test ==="`,
  `echo -n "HTTP admin: " && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/admin 2>/dev/null`,
  `echo ""`,
  `echo -n "HTTPS admin: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin 2>/dev/null`,
  `echo ""`,
  `echo -n "HTTPS admin/dashboard: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/admin/dashboard 2>/dev/null`,
  `echo ""`,
  `echo "=== Check admin.html content for sidebar ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin 2>/dev/null | grep -o 'AdminSidebar\\|admin-sidebar\\|hidden lg:flex flex-col w-56\\|Awesome.*后台' | head -5`,
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
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 30000 });
