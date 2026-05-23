const { Client } = require('ssh2');
const fs = require('fs');
const PASS = fs.readFileSync('d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs','utf8').match(/const PASS = '([^']+)'/)[1];
function exec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      let out='';
      stream.on('data', d => { out+=d; process.stdout.write(d); });
      stream.stderr.on('data', d => process.stderr.write(d));
      stream.on('close', () => resolve(out));
    });
  });
}
const c = new Client();
c.on('ready', async () => {
  await exec(c, "docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -c \"\\d schema_migrations\"");
  await exec(c, "docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -c \"select * from schema_migrations order by 1 desc limit 15;\"");
  await exec(c, "curl -sS -o /dev/null -w 'stories8081:%{http_code}\\n' http://127.0.0.1:8081/admin/stories.html");
  c.end();
}).connect({ host:'210.16.165.251', port:22, username:'root', password:PASS });
