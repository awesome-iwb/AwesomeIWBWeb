const { Client } = require("ssh2");
const fs = require("fs");
const PASS = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs", "utf8").match(/const PASS = '([^']+)'/)[1];
const cmd = [
  "stat -c '%y %s %n' /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/admin/projects.html",
  "docker ps --format '{{.Names}}' | head -20",
  "curl -sS -o /dev/null -w 'nginx80_projects:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/admin/projects.html",
  "curl -sS -o /dev/null -w 'nginx80_health:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1/api/health",
  "curl -sS -o /dev/null -w 'openresty443_projects:%{http_code}\\n' -k -H 'Host: aiwb.smart-teach.cn' https://127.0.0.1/admin/projects.html",
  "docker logs 1Panel-openresty-zpMY --tail 15 2>&1",
].join("\n");
const c = new Client();
c.on("ready", () => c.exec(cmd, (e,s)=>{s.on("data",d=>process.stdout.write(d));s.stderr.on("data",d=>process.stderr.write(d));s.on("close",()=>c.end());})).connect({host:"210.16.165.251",port:22,username:"root",password:PASS,readyTimeout:60000});
