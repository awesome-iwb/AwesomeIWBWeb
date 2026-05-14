const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec(`echo "---DOCKER BACKEND---" && docker logs awesomeiwb-backend --tail 20 2>&1 && echo "---DOCKER COMPOSE---" && cd /opt/awesomeiwb/deploy && cat docker-compose.yml | grep -A5 "backend:" | head -10 && echo "---REBUILD---" && cd /opt/awesomeiwb/deploy && docker compose build backend 2>&1 | tail -5 && echo "---RESTART---" && docker compose up -d backend 2>&1 && sleep 5 && docker ps | grep backend && echo "---HEALTH---" && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/ && echo "" && echo "DEPLOY COMPLETE"`, (err, stream) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    let out = '';
    stream.on('data', (data) => { out += data; process.stdout.write(data); });
    stream.stderr.on('data', (data) => { out += data; process.stdout.write(data); });
    stream.on('close', () => { console.log('\n--- DONE ---'); conn.end(); process.exit(0); });
  });
});

conn.on('error', (err) => { console.error(err.message); process.exit(1); });
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
setTimeout(() => { conn.end(); process.exit(1); }, 120000);
