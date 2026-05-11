const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  "netstat -tlnp | grep -E '8080|8081|80|443'",
  "systemctl status awesomeiwb-backend --no-pager",
  "curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8080/api/health",
  "curl -s -H 'Host: awesomeiwb.cn' http://127.0.0.1/api/health",
  "ps aux | grep -E 'nginx|openresty' | grep -v grep",
  "ls -la /etc/nginx/sites-enabled/",
];

let i = 0;
function runNext() {
  if (i >= commands.length) { conn.end(); return; }
  console.log(`\n[${i + 1}/${commands.length}] ${commands[i].substring(0, 60)}`);
  conn.exec(commands[i], (err, stream) => {
    if (err) { console.error(err); i++; runNext(); return; }
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", () => { i++; runNext(); });
  });
}

conn.on("ready", runNext).on("error", (err) => console.error("Error:", err));
conn.connect({ host: "210.16.165.251", port: 22, username: "root", password: "8EGZ4jf3vumREH", readyTimeout: 60000 });
