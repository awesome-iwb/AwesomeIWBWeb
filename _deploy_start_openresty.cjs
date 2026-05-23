const { Client } = require("ssh2");
const fs = require("fs");
const PASS = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs", "utf8").match(/const PASS = '([^']+)'/)[1];
const cmd = [
  "set -e",
  "docker start 1Panel-openresty-zpMY",
  "sleep 3",
  "docker ps --format '{{.Names}} {{.Status}}' | grep openresty",
  "ss -tlnp | grep -E ':80 |:443 ' || true",
  "curl -sS -o /dev/null -w 'health_pub:%{http_code}\\n' https://aiwb.smart-teach.cn/api/health",
  "curl -sS -o /dev/null -w 'projects_pub:%{http_code}\\n' https://aiwb.smart-teach.cn/admin/projects.html",
  "curl -sS -o /dev/null -w 'tags_html_pub:%{http_code}\\n' https://aiwb.smart-teach.cn/admin/tags.html",
  "curl -sS -I https://aiwb.smart-teach.cn/admin/tags 2>/dev/null | head -8",
  "curl -sS -o /dev/null -w 'health8081:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/health",
].join("\n");
const c = new Client();
c.on("ready", () => c.exec(cmd, (e,s)=>{s.on("data",d=>process.stdout.write(d));s.stderr.on("data",d=>process.stderr.write(d));s.on("close",code=>{console.log('exit',code);c.end();process.exit(code||0);});})).connect({host:"210.16.165.251",port:22,username:"root",password:PASS,readyTimeout:120000});
