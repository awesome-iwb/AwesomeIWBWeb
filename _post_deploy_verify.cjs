const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const HOST = "210.16.165.251", USER = "root", PASS = "8EGZ4jf3vumREH";
const ROOT = path.resolve(__dirname);
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
function put(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(local);
    const ws = sftp.createWriteStream(remote);
    rs.on("error", reject); ws.on("error", reject); ws.on("close", resolve);
    rs.pipe(ws);
  });
}
(async () => {
  const conn = new Client();
  await new Promise((res, rej) => conn.on("ready", res).on("error", rej).connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 120000 }));
  const cronLocal = path.join(ROOT, "deploy/cron.d/awesomeiwb-github-sync");
  const sftp = await new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));
  await put(sftp, cronLocal, "/opt/awesomeiwb/deploy/cron.d/awesomeiwb-github-sync");
  await exec(conn, "mkdir -p /var/log/awesomeiwb");
  await exec(conn, "cp /opt/awesomeiwb/deploy/cron.d/awesomeiwb-github-sync /etc/cron.d/awesomeiwb-github-sync && chmod 644 /etc/cron.d/awesomeiwb-github-sync");
  console.log("\n>>> migration status");
  await exec(conn, `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"`);
  console.log("\n>>> github sync");
  const sync = await exec(conn, "docker exec awesomeiwb-backend bun run src/scripts/sync-github-stats.ts");
  console.log("sync exit:", sync.code);
  console.log("\n>>> tag_definitions count");
  await exec(conn, `docker exec awesomeiwb-pg psql -U awesomeiwb -d awesomeiwb -t -c "SELECT COUNT(*) FROM tag_definitions;"`);
  console.log("\n>>> verifications");
  await exec(conn, "curl -sS -o /dev/null -w 'health:%{http_code}\\n' https://aiwb.smart-teach.cn/api/health");
  await exec(conn, "curl -sS -o /dev/null -w 'tags:%{http_code}\\n' https://aiwb.smart-teach.cn/api/tags");
  await exec(conn, "curl -sS 'https://aiwb.smart-teach.cn/api/projects?limit=1' | head -c 400");
  console.log("\n");
  await exec(conn, "curl -sS 'https://aiwb.smart-teach.cn/api/projects/Ink%20Canvas' | head -c 600");
  console.log("\n");
  conn.end();
})().catch(e => { console.error(e); process.exit(1); });
