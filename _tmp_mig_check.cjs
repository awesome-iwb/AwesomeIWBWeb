const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const PASS = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs","utf8").match(/const PASS = '([^']+)'/)[1];
const local = fs.readdirSync("d:/github/AwesomeIWBWeb/backend/migrations").filter(f=>f.endsWith(".sql")).sort();
function exec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      let out = "";
      stream.on("data", d => out += d);
      stream.stderr.on("data", d => out += d);
      stream.on("close", code => resolve({ code, out }));
    });
  });
}
(async () => {
  const c = new Client();
  await new Promise((res, rej) => c.on("ready", res).on("error", rej).connect({ host:"210.16.165.251", port:22, username:"root", password:PASS }));
  const r = await exec(c, "docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -A -c \"SELECT version FROM schema_migrations ORDER BY version;\"");
  const prod = r.out.trim().split(/\n/).filter(Boolean);
  const missing = local.filter(f => !prod.includes(f));
  const extra = prod.filter(f => !local.includes(f));
  console.log("local_count", local.length, "prod_count", prod.length);
  console.log("missing_on_prod", missing.length ? missing.join(", ") : "(none)");
  console.log("extra_on_prod", extra.length ? extra.join(", ") : "(none)");
  await exec(c, "docker ps --format '{{.Names}} {{.Status}}' | grep -E 'awesomeiwb|openresty'");
  await exec(c, "docker inspect awesomeiwb-backend --format '{{.State.Health.Status}}' 2>/dev/null || docker ps --filter name=awesomeiwb-backend --format '{{.Status}}'");
  c.end();
})();
