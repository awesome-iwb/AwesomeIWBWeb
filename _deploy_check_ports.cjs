const { Client } = require("ssh2");
const fs = require("fs");
const PASS = fs.readFileSync("d:/github/AwesomeIWBWeb/_deploy_tags_live.cjs", "utf8").match(/const PASS = '([^']+)'/)[1];
const cmd = [
  "docker ps -a --format '{{.Names}} {{.Status}}' | grep -iE 'openresty|nginx|1panel' || true",
  "ss -tlnp | grep -E ':80|:443|:8081' || true",
  "curl -sS -o /dev/null -w '8081_projects:%{http_code}\\n' -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/admin/projects.html",
  "curl -sS http://127.0.0.1:8081/admin/projects.html 2>&1 | head -c 200",
  "echo",
].join("\n");
const c = new Client();
c.on("ready", () => c.exec(cmd, (e,s)=>{s.on("data",d=>process.stdout.write(d));s.stderr.on("data",d=>process.stderr.write(d));s.on("close",()=>c.end());})).connect({host:"210.16.165.251",port:22,username:"root",password:PASS,readyTimeout:60000});
