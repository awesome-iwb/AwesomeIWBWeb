const { Client } = require('ssh2');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';

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

async function must(conn, cmd) {
  const out = await exec(conn, cmd);
  process.stdout.write(`\n--- ${cmd} ---\n${out.stdout}${out.stderr}`);
  if (out.code !== 0) {
    throw new Error(`Command failed (${out.code}): ${cmd}`);
  }
  return out;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      port: 22,
      username: USER,
      password: PASS,
      readyTimeout: 60000,
      keepaliveInterval: 10000,
    });
  });

  try {
    await must(conn, 'cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build');
    await must(conn, 'rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/');

    await must(
      conn,
      "docker exec 1Panel-openresty-zpMY sh -lc 'openresty -t && openresty -s reload'"
    );

    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/ | sed -n '1,20p'");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/sw.js | sed -n '1,20p'");
    await must(conn, "curl -sSI https://aiwb.smart-teach.cn/api/auth/login?popup=1 | sed -n '1,20p'");

    console.log('\nDONE: full build + full dist sync + openresty reload + smoke checks');
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
