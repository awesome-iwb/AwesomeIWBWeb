const { Client } = require('ssh2');
const fs = require('fs');
const PASS = fs.readFileSync('d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs','utf8').match(/const PASS = '([^']+)'/)[1];
function exec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ code: 1, out: String(err) });
      let out = '';
      stream.on('data', d => { out += d; process.stdout.write(d); });
      stream.stderr.on('data', d => { out += d; process.stderr.write(d); });
      stream.on('close', code => resolve({ code, out }));
    });
  });
}
const c = new Client();
c.on('ready', async () => {
  await exec(c, 'docker ps -a --filter name=awesomeiwb-backend --format "{{.Names}} {{.Status}}"');
  await exec(c, 'docker logs awesomeiwb-backend --tail 40 2>&1');
  await exec(c, 'cat /opt/awesomeiwb/deploy/docker-compose.yml 2>/dev/null | head -80');
  c.end();
}).connect({ host:'210.16.165.251', port:22, username:'root', password:PASS });
