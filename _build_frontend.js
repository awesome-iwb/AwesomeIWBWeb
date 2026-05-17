const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', async () => {
  function execCmd(cmd, label) {
    return new Promise((resolve) => {
      console.log(`\n>>> ${label || cmd.substring(0, 100)}`);
      conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); resolve(''); return; }
        stream.on('data', (data) => process.stdout.write(data.toString()));
        stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
        stream.on('close', () => resolve(''));
      });
    });
  }

  console.log('\n=== Build frontend ===');
  await execCmd('cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -25', 'Build frontend', 120000);

  console.log('\n=== Deploy frontend ===');
  await execCmd('rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Frontend deployed!"', 'Deploy frontend');

  console.log('\n=== Verify ===');
  await execCmd('echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/');
  await execCmd('echo -n "Categories: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/categories');
  await execCmd('echo -n "Today: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/today');
  await execCmd('echo -n "API /api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects');
  await execCmd('echo -n "Dev API: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/dev/dashboard');

  console.log('\n\n=== FRONTEND DEPLOYMENT COMPLETE ===');
  conn.end();
});

conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
