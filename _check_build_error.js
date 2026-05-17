const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', async () => {
  conn.exec(`cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | head -80`, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', (data) => process.stdout.write(data.toString()));
    stream.stderr.on('data', (data) => process.stdout.write(data.toString()));
    stream.on('close', () => conn.end());
  });
});

conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
