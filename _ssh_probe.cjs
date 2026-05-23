const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec(
    `grep -E '^(DATABASE_URL|POSTGRES_)' /etc/awesomeiwb/backend.env | sed 's/=.*$/=***/';
echo '---';
docker ps --format '{{.Names}}' 2>/dev/null || true;
echo '---';
test -f /opt/awesomeiwb/deploy/docker-compose.yml && echo has_compose;
systemctl is-active awesomeiwb-backend 2>/dev/null || true`,
    (e, s) => {
      s.on('data', (d) => process.stdout.write(d));
      s.stderr.on('data', (d) => process.stderr.write(d));
      s.on('close', () => c.end());
    }
  );
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH' });
