const { Client } = require('ssh2');

const host = '210.16.165.251';
const username = 'root';
const password = '8EGZ4jf3vumREH';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => (stdout += d.toString()));
      stream.stderr.on('data', (d) => (stderr += d.toString()));
      stream.on('close', (code) => resolve({ code, stdout, stderr, cmd }));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host,
      port: 22,
      username,
      password,
      readyTimeout: 60000,
      keepaliveInterval: 10000,
    });
  });

  const cmds = [
    "ss -ltnp | grep -E ':80 |:443 |:8081 ' || true",
    "docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'",
    "curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/auth/me | sed -n '1,20p'",
    "curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/feedback | sed -n '1,20p'",
    "curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/stories | sed -n '1,20p'",
    "curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/projects | sed -n '1,20p'",
    "curl -sS -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/stories | head -c 220",
    "curl -sS -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/projects | head -c 220",
    "etag=$(curl -sSI -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/stories | tr -d '\\r' | awk -F': ' 'tolower($1)==\"etag\"{print $2}' | tail -1); echo ETAG=$etag; if [ -n \"$etag\" ]; then curl -sSI -H 'Host: aiwb.smart-teach.cn' -H \"If-None-Match: $etag\" http://127.0.0.1/api/stories | sed -n '1,20p'; fi",
    "curl -sSI https://aiwb.smart-teach.cn/api/auth/me | sed -n '1,20p'",
    "curl -sSI https://aiwb.smart-teach.cn/api/stories | sed -n '1,20p'",
  ];

  for (const cmd of cmds) {
    const out = await exec(conn, cmd);
    console.log(`\n--- ${cmd} ---`);
    process.stdout.write(out.stdout + out.stderr);
  }

  conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
