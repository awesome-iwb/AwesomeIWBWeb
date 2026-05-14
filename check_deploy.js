const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connected!');
  conn.exec(`cd /opt/awesomeiwb && git log --oneline -5 && echo "---GIT STATUS---" && git status --short && echo "---BACKEND LOG---" && journalctl -u awesomeiwb-backend -n 30 --no-pager 2>&1 && echo "---FRONTEND---" && ls /var/www/awesomeiwb/dist/ 2>&1 | head -10 && echo "---NGINX---" && nginx -t 2>&1 && echo "---PORTS---" && ss -tlnp | grep -E '8081|80|443' 2>&1`, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); process.exit(1); }
    let out = '';
    stream.on('data', (data) => { out += data; });
    stream.stderr.on('data', (data) => { out += data; });
    stream.on('close', () => {
      console.log(out.substring(0, 5000));
      conn.end();
      process.exit(0);
    });
  });
});

conn.on('error', (err) => { console.error('SSH error:', err.message); process.exit(1); });
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
setTimeout(() => { console.log('Timeout'); conn.end(); process.exit(1); }, 30000);
