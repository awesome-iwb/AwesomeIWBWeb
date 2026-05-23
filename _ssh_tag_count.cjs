const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec(
    `docker exec awesomeiwb-pg psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "select count(*) from tag_definitions;" 2>/dev/null || docker exec awesomeiwb-pg sh -c 'psql -U postgres -d awesomeiwb -t -c "select count(*) from tag_definitions;"'`,
    (e, s) => {
      s.on('data', (d) => process.stdout.write('tag_count:' + d));
      s.stderr.on('data', (d) => process.stderr.write(d));
      s.on('close', () => c.end());
    }
  );
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH' });
