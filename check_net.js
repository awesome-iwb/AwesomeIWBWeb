const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec(`docker network ls && echo "---" && docker inspect awesomeiwb-backend --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>&1 && echo "---" && docker inspect awesomeiwb-pg --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>&1 && echo "---" && docker inspect awesomeiwb-backend --format '{{json .NetworkSettings.Networks}}' 2>&1 && echo "---PG---" && docker inspect awesomeiwb-pg --format '{{json .NetworkSettings.Networks}}' 2>&1`, (err, stream) => {
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
