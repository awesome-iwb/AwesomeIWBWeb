const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const PASS = "8EGZ4jf3vumREH";
const ROOT = path.resolve("d:/github/AwesomeIWBWeb");
function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let o = "";
      let er = "";
      stream.on("data", (d) => (o += d));
      stream.stderr.on("data", (d) => (er += d));
      stream.on("close", (code) => resolve({ code, o, er }));
    });
  });
}
async function run(conn, label, cmd) {
  const x = await exec(conn, cmd);
  console.log("---", label, "exit", x.code);
  console.log((x.o || x.er).trim());
  return x;
}
(async () => {
  const conn = new Client();
  await new Promise((r, j) =>
    conn.on("ready", r).on("error", j).connect({
      host: "210.16.165.251",
      username: "root",
      password: PASS,
      readyTimeout: 120000,
    })
  );
  await run(
    conn,
    "migration 0037",
    `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -tAc "SELECT version FROM schema_migrations WHERE version LIKE '%0037%' OR version LIKE '%sync_job%';"`
  );
  await run(
    conn,
    "recent migrations",
    `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -tAc "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 10;"`
  );
  await run(
    conn,
    "sync.html www",
    "test -f /var/www/awesomeiwb/dist/admin/sync.html && echo OK || echo MISSING"
  );
  await run(
    conn,
    "sync.html openresty",
    "test -f /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/admin/sync.html && echo OK || echo MISSING"
  );
  await run(
    conn,
    "api admin sync",
    "curl -sS -o /dev/null -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/admin/sync/github"
  );
  await run(conn, "public health", "curl -sS -o /dev/null -w '%{http_code}' https://aiwb.smart-teach.cn/api/health");
  await run(conn, "public sync page", "curl -sS -o /dev/null -w '%{http_code}' https://aiwb.smart-teach.cn/admin/sync.html");
  await run(
    conn,
    "GITHUB_TOKEN",
    "bash -lc 'if grep -qE \"^GITHUB_TOKEN=.+\" /etc/awesomeiwb/backend.env; then echo SET; else echo MISSING; fi'"
  );
  const cronLocal = path.join(ROOT, "deploy/cron.d/awesomeiwb-github-sync");
  const cronBody = fs.readFileSync(cronLocal, "utf8");
  const b64 = Buffer.from(cronBody).toString("base64");
  await run(
    conn,
    "install cron",
    `echo ${b64} | base64 -d > /etc/cron.d/awesomeiwb-github-sync && chmod 644 /etc/cron.d/awesomeiwb-github-sync && echo INSTALLED`
  );
  await run(conn, "cron file", "head -n 5 /etc/cron.d/awesomeiwb-github-sync");
  await run(
    conn,
    "optional sync once",
    "docker exec awesomeiwb-backend bun run src/scripts/sync-github-stats.ts 2>&1 | tail -n 20"
  );
  conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
