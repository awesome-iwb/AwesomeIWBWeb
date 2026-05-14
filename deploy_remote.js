const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connected! Running deploy with env...');
  conn.exec(`cd /opt/awesomeiwb && source /etc/awesomeiwb/backend.env && export DATABASE_URL && cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate 2>&1 && echo "---MIGRATE DONE---" && cd /opt/awesomeiwb/frontend && /usr/local/bin/bun install 2>&1 && /usr/local/bin/bun run build 2>&1 | tail -5 && echo "---FRONTEND BUILD DONE---" && rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/ && echo "---RSYNC DONE---" && systemctl restart awesomeiwb-backend && echo "---BACKEND RESTARTED---" && sleep 5 && systemctl is-active awesomeiwb-backend && echo "---STATUS---" && nginx -t 2>&1 && systemctl reload nginx && echo "DEPLOY COMPLETE"`, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); process.exit(1); }
    let out = '';
    stream.on('data', (data) => { out += data; process.stdout.write(data); });
    stream.stderr.on('data', (data) => { out += data; process.stdout.write(data); });
    stream.on('close', () => {
      console.log('\n--- DONE ---');
      conn.end();
      process.exit(0);
    });
  });
});

conn.on('error', (err) => { console.error('SSH error:', err.message); process.exit(1); });
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
setTimeout(() => { console.log('Timeout'); conn.end(); process.exit(1); }, 180000);
