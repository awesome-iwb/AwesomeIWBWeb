const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = [
    'docker exec awesomeiwb-backend bun run src/scripts/migrate-feishu-tags-to-registry.ts',
    'docker restart awesomeiwb-backend',
    'sleep 8',
    "curl -sS -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/tags | head -c 500",
  ].join(' && ');
  c.exec(cmd, (e, s) => {
    s.on('data', (d) => process.stdout.write(d));
    s.stderr.on('data', (d) => process.stderr.write(d));
    s.on('close', (code) => {
      console.log('\nexit', code);
      c.end();
    });
  });
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH' });
