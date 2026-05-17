const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connected!');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    const localPath = 'D:\\github\\AwesomeIWBWeb\\frontend\\src\\views\\HomeView.vue';
    const remotePath = '/opt/awesomeiwb/frontend/src/views/HomeView.vue';
    console.log('Uploading HomeView.vue...');
    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.on('close', () => {
      console.log('File uploaded!');
      const commands = [
        `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -5`,
        `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Deployed"`,
        `echo -n "HTTPS /: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
      ];
      let idx = 0;
      function runNext() {
        if (idx >= commands.length) { console.log('\nDone!'); conn.end(); return; }
        conn.exec(commands[idx], (err2, stream) => {
          if (err2) { console.error('Error:', err2.message); idx++; runNext(); return; }
          stream.on('data', (data) => process.stdout.write(data.toString()));
          stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
          stream.on('close', () => { idx++; runNext(); });
        });
      }
      runNext();
    });
    writeStream.on('error', (e) => { console.error('Write error:', e); conn.end(); });
    readStream.pipe(writeStream);
  });
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
