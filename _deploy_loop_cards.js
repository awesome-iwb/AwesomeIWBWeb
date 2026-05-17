const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const conn = new Client();

const files = [
  { local: 'frontend/src/views/HomeView.vue', remote: '/opt/awesomeiwb/frontend/src/views/HomeView.vue' },
  { local: 'frontend/src/components/admin/FloatingPanel.vue', remote: '/opt/awesomeiwb/frontend/src/components/admin/FloatingPanel.vue' },
  { local: 'frontend/src/views/admin/UsersView.vue', remote: '/opt/awesomeiwb/frontend/src/views/admin/UsersView.vue' },
];

conn.on('ready', () => {
  console.log('SSH connected!');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    let idx = 0;
    function uploadNext() {
      if (idx >= files.length) {
        console.log('\nAll files uploaded! Building on server...');
        const commands = [
          `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -10`,
          `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Deployed!"`,
          `echo -n "HTTPS /: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
        ];
        let cmdIdx = 0;
        function runNext() {
          if (cmdIdx >= commands.length) { console.log('\nAll done!'); conn.end(); return; }
          conn.exec(commands[cmdIdx], (err2, stream) => {
            if (err2) { console.error('Error:', err2.message); cmdIdx++; runNext(); return; }
            stream.on('data', (data) => process.stdout.write(data.toString()));
            stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
            stream.on('close', () => { cmdIdx++; runNext(); });
          });
        }
        runNext();
        return;
      }

      const f = files[idx];
      const localPath = path.join('D:\\github\\AwesomeIWBWeb', f.local);
      console.log(`Uploading ${f.local}...`);
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(f.remote);
      writeStream.on('close', () => {
        console.log(`  ✓ ${f.local}`);
        idx++;
        uploadNext();
      });
      writeStream.on('error', (e) => { console.error(`  ✗ ${f.local}:`, e.message); conn.end(); });
      readStream.pipe(writeStream);
    }
    uploadNext();
  });
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
