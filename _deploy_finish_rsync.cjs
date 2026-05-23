const { Client } = require("ssh2");
const fs = require("fs");
const PASS = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs", "utf8").match(/const PASS = '([^']+)'/)[1];
const OPENRESTY = "/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist";
const WWW = "/var/www/awesomeiwb/dist";
const cmd = [
  "set -e",
  `mkdir -p ${WWW} ${OPENRESTY}`,
  `rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${WWW}/`,
  `rsync -a --delete /opt/awesomeiwb/frontend/dist/ ${OPENRESTY}/`,
  "chown -R www-data:www-data " + WWW + " || true",
  "echo RSYNC_OK",
  "curl -sS -o /dev/null -w 'health8081:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/health",
  "curl -sS -o /dev/null -w 'projects8081:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/admin/projects.html",
  "curl -sS -o /dev/null -w 'tags8081:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/admin/tags.html",
  "curl -sS -I -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/admin/tags 2>/dev/null | head -5",
  "curl -sS -o /dev/null -w 'health443:%{http_code}\\n' https://aiwb.smart-teach.cn/api/health",
  "curl -sS -o /dev/null -w 'projects443:%{http_code}\\n' https://aiwb.smart-teach.cn/admin/projects.html",
  "curl -sS -o /dev/null -w 'tags443:%{http_code}\\n' https://aiwb.smart-teach.cn/admin/tags.html",
].join("\n");
const c = new Client();
c.on("ready", () => c.exec(cmd, (e, s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", code => { console.log("exit", code); c.end(); process.exit(code || 0); });
})).connect({ host: "210.16.165.251", port: 22, username: "root", password: PASS, readyTimeout: 120000 });
