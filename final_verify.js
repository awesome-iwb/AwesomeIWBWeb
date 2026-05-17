const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Final verification ==="`,
  `echo -n "/admin: " && curl -sk -o /dev/null -w "%{http_code} cf-cache=%{header_json}" https://aiwb.smart-teach.cn/admin 2>/dev/null; echo ""`,
  `curl -sI https://aiwb.smart-teach.cn/admin 2>/dev/null | grep -i "cache\\|last-modified\\|cf-\\|etag"`,
  `echo ""`,
  `echo "=== Check if old JS bundles are still accessible ==="`,
  `echo -n "Old app.js: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/assets/app-D2Jx3-Y0.js 2>/dev/null`,
  `echo ""`,
  `echo -n "New app.js: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/assets/app-C9l23V0H.js 2>/dev/null`,
  `echo ""`,
  `echo "=== Verify sidebar is in the served HTML ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin 2>/dev/null | grep -c 'hidden lg:flex flex-col w-56'`,
  `echo "=== Verify dashboard grid is in the served HTML ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin/dashboard 2>/dev/null | grep -c 'grid-cols-2 lg:grid-cols-4'`,
  `echo "=== Verify no old tab layout ==="`,
  `curl -sk https://aiwb.smart-teach.cn/admin 2>/dev/null | grep -c 'admin-tab\\|tab-btn\\|选项卡'`,
  `echo ""`,
  `echo "=== Purge Cloudflare cache via API (if possible) ==="`,
  `echo "Cloudflare cache needs to be purged manually or via API"`,
  `echo "The site is behind Cloudflare, old cached pages may still be served"`,
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
