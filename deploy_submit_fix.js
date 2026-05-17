const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const conn = new Client();

const filesToUpload = [
  { local: 'frontend/src/views/SubmitProjectView.vue', remote: '/opt/awesomeiwb/frontend/src/views/SubmitProjectView.vue' },
];

conn.on('ready', () => {
  console.log('SSH connected!');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    let idx = 0;
    function uploadNext() {
      if (idx >= filesToUpload.length) {
        console.log('\nAll files uploaded! Building...');
        buildFrontend();
        return;
      }
      const { local, remote } = filesToUpload[idx];
      const localPath = path.join('D:\\github\\AwesomeIWBWeb', local);
      console.log(`Uploading ${local}...`);
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remote);
      writeStream.on('close', () => { console.log('  done'); idx++; uploadNext(); });
      writeStream.on('error', (e) => { console.error('  ERROR:', e.message); idx++; uploadNext(); });
      readStream.pipe(writeStream);
    }
    uploadNext();
  });

  function buildFrontend() {
    const commands = [
      `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -5`,
      `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Frontend deployed"`,
    ];
    let cmdIdx = 0;
    function runNext() {
      if (cmdIdx >= commands.length) { console.log('\nAll done!'); conn.end(); return; }
      conn.exec(commands[cmdIdx], (err, stream) => {
        if (err) { console.error(err); cmdIdx++; runNext(); return; }
        stream.on('data', (data) => process.stdout.write(data.toString()));
        stream.stderr.on('data', (data) => process.stdout.write(data.toString()));
        stream.on('close', () => { cmdIdx++; runNext(); });
      });
    }
    runNext();
  }
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 30000 });
setTimeout(() => { conn.end(); process.exit(1); }, 300000);
