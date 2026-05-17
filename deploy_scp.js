const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connected!');
  
  const localFile = 'D:\\github\\AwesomeIWBWeb\\frontend\\src\\views\\HomeView.vue';
  const fs = require('fs');
  const fileContent = fs.readFileSync(localFile, 'utf-8');
  
  conn.exec('cat > /opt/awesomeiwb/frontend/src/views/HomeView.vue << \'ENDOFFILE\'\n' + fileContent.replace(/'/g, "'\\''") + '\nENDOFFILE', (err, stream) => {
    if (err) { console.error('Error:', err.message); conn.end(); return; }
    stream.on('data', (data) => process.stdout.write(data.toString()));
    stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
    stream.on('close', (code) => {
      console.log('File uploaded, exit code:', code);
      
      const commands = [
        `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -5`,
        `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Deployed"`,
        `grep -c "activeHeroSlide" /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/assets/HomeView*.js 2>/dev/null`,
      ];
      
      let idx = 0;
      function runNext() {
        if (idx >= commands.length) { console.log('\nDone'); conn.end(); return; }
        conn.exec(commands[idx], (err2, stream2) => {
          if (err2) { console.error('Error:', err2.message); idx++; runNext(); return; }
          stream2.on('data', (data) => process.stdout.write(data.toString()));
          stream2.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
          stream2.on('close', () => { idx++; runNext(); });
        });
      }
      runNext();
    });
  });
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
