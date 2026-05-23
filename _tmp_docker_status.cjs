const { Client } = require("ssh2");
const fs = require("fs");
const PASS = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs","utf8").match(/const PASS = '([^']+)'/)[1];
function exec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      let out = "";
      stream.on("data", d => { out += d; process.stdout.write(d); });
      stream.stderr.on("data", d => process.stderr.write(d));
      stream.on("close", () => resolve(out));
    });
  });
}
(async () => {
  const c = new Client();
  await new Promise((res, rej) => c.on("ready", res).on("error", rej).connect({ host:"210.16.165.251", port:22, username:"root", password:PASS }));
  await exec(c, "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'awesomeiwb|openresty|NAMES'");
  c.end();
})();
