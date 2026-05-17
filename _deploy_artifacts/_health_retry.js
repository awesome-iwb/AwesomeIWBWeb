const { Client } = require('ssh2');
const PASS = process.env.SSH_PASS;
const conn = new Client();
conn.on('ready', () => {
  const cmd = `sleep 12
docker ps --filter name=awesomeiwb-backend --format '{{.Names}} {{.Status}}'
docker logs awesomeiwb-backend --tail 30 2>&1 || true
for i in 1 2 3 4 5 6 7 8; do
  code=$(curl -sS -o /tmp/hb.txt -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health 2>/dev/null || echo 000)
  echo "retry $i HEALTH=$code"
  head -c 120 /tmp/hb.txt 2>/dev/null; echo
  if [ "$code" = "200" ]; then exit 0; fi
  sleep 5
done
exit 2`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', code => { conn.end(); process.exit(code); });
  });
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: PASS });
