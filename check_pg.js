const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec(`docker exec awesomeiwb-backend cat /app/node_modules/postgres/package.json 2>&1 | grep version | head -1 && echo "---ERROR LOG---" && docker logs awesomeiwb-backend --tail 10 2>&1`, (err, stream) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    let out = '';
    stream.on('data', (data) => { out += data; });
    stream.stderr.on('data', (data) => { out += data; });
    stream.on('close', () => { console.log(out); conn.end(); process.exit(0); });
  });
});

conn.on('error', (err) => { console.error(err.message); process.exit(1); });
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
setTimeout(() => { conn.end(); process.exit(1); }, 15000);
