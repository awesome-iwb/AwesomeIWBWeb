const { Client } = require("ssh2");
const fs = require("fs");
const src = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs", "utf8");
const PASS = src.match(/const PASS = '([^']+)'/)[1];
const OPENRESTY = "/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist";
const WWW = "/var/www/awesomeiwb/dist";
const cmd = [
  "echo ===PROCESSES===",
  "pgrep -af bun || true",
  "echo ===BACKEND===",
  "docker ps --format '{{.Names}} {{.Status}}' | grep awesomeiwb || true",
  "echo ===HEALTH8081===",
  "curl -sS -o /dev/null -w '%{http_code}' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/health; echo",
  "echo ===DIST_TIMES===",
  "stat -c '%y %n' /opt/awesomeiwb/frontend/dist/admin/projects.html 2>/dev/null || echo no_build_dist",
  "stat -c '%y %n' " + WWW + "/admin/projects.html 2>/dev/null || echo no_www_dist",
  "stat -c '%y %n' " + OPENRESTY + "/admin/projects.html 2>/dev/null || echo no_openresty_dist",
].join("\n");
const c = new Client();
c.on("ready", () => c.exec(cmd, (e, s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", code => { console.log("\nexit", code); c.end(); });
})).connect({ host: "210.16.165.251", port: 22, username: "root", password: PASS, readyTimeout: 60000 });
