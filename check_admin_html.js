const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== admin.html content (first 100 lines) ==="`,
  `head -100 /var/www/awesomeiwb/dist/admin.html`,
  `echo ""`,
  `echo "=== admin/dashboard.html content (first 50 lines) ==="`,
  `head -50 /var/www/awesomeiwb/dist/admin/dashboard.html`,
  `echo ""`,
  `echo "=== Check for old AdminView references in JS bundles ==="`,
  `grep -l "选项卡\\|tab-btn\\|admin-tab\\|AdminView" /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -5`,
  `echo ""`,
  `echo "=== Check for AdminSidebar in JS bundles ==="`,
  `grep -l "AdminSidebar\\|admin-sidebar\\|admin-sidebar" /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -5`,
  `echo ""`,
  `echo "=== Check for DashboardView in JS bundles ==="`,
  `grep -l "DashboardView\\|DashboardCard\\|总览" /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | head -5`,
  `echo ""`,
  `echo "=== Check JS bundle timestamps ==="`,
  `ls -la /var/www/awesomeiwb/dist/assets/*.js | head -10`,
  `echo ""`,
  `echo "=== Check Cloudflare headers ==="`,
  `curl -sI https://aiwb.smart-teach.cn/admin 2>/dev/null | head -20`,
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
