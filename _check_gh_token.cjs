const { Client } = require("ssh2");
const HOST = "210.16.165.251", USER = "root", PASS = "8EGZ4jf3vumREH";
function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "", stderr = "";
      stream.on("data", d => { stdout += d; process.stdout.write(d); });
      stream.stderr.on("data", d => { stderr += d; process.stderr.write(d); });
      stream.on("close", code => resolve({ code, stdout, stderr }));
    });
  });
}
(async () => {
  const conn = new Client();
  await new Promise((res, rej) => conn.on("ready", res).on("error", rej).connect({ host: HOST, port: 22, username: USER, password: PASS }));
  console.log(">>> backend.env GITHUB_TOKEN presence");
  await exec(conn, "grep -E '^GITHUB_TOKEN=' /etc/awesomeiwb/backend.env | sed 's/=.*/=***REDACTED***/' || echo MISSING");
  console.log("\n>>> docker env in backend container");
  await exec(conn, "docker exec awesomeiwb-backend sh -c 'echo GITHUB_TOKEN=${GITHUB_TOKEN:+set}${GITHUB_TOKEN:-unset}'");
  console.log("\n>>> deploy compose env section");
  await exec(conn, "sed -n '1,120p' /opt/awesomeiwb/deploy/docker-compose.yml");
  conn.end();
})().catch(e => { console.error(e); process.exit(1); });
