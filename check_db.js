const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec(`cat /etc/awesomeiwb/backend.env 2>&1 | grep -v PASSWORD | grep -v SECRET | grep -v KEY && echo "---DOCKER---" && docker ps 2>&1 && echo "---DB CHECK---" && docker exec awesomeiwb-pg pg_isready 2>&1 && echo "---DB CONN---" && docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 3;" 2>&1`, (err, stream) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    let out = '';
    stream.on('data', (data) => { out += data; });
    stream.stderr.on('data', (data) => { out += data; });
    stream.on('close', () => { console.log(out); conn.end(); process.exit(0); });
  });
});

conn.on('error', (err) => { console.error(err.message); process.exit(1); });
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
setTimeout(() => { conn.end(); process.exit(1); }, 20000);
