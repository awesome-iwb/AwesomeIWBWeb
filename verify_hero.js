const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  `echo "=== Check for carousel code in JS ==="`,
  `grep -l "onTouchStart\\|onTouchMove\\|onTouchEnd\\|activeHeroSlide\\|swipeable\\|translateX" /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/assets/HomeView*.js 2>/dev/null`,
  `echo "=== Check for old fan card code ==="`,
  `grep -c "isCardsExpanded" /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/assets/HomeView*.js 2>/dev/null || echo "0"`,
  `echo "=== Check HTML for mobile carousel ==="`,
  `grep -o "lg:hidden.*mt-8\\|Dots indicator\\|rounded-full.*bg-emerald-500.*w-5" /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/index.html 2>/dev/null | head -5`,
  `echo "=== Check HomeView JS size ==="`,
  `ls -la /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/assets/HomeView*.js 2>/dev/null`,
  `echo "=== Test homepage ==="`,
  `echo -n "HTTPS /: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
];

conn.on('ready', () => {
  console.log('SSH connected!');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nDone'); conn.end(); return; }
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
