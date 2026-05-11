const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  "docker exec 1Panel-openresty-zpMY ls -la /usr/local/openresty/nginx/conf/conf.d/",
  "docker exec 1Panel-openresty-zpMY cat /usr/local/openresty/nginx/conf/conf.d/aiwb.smart-teach.cn.conf 2>/dev/null || echo 'No site conf in container'",
  "docker exec 1Panel-openresty-zpMY ls -la /www/sites/aiwb.smart-teach.cn/proxy/ 2>/dev/null || echo 'No proxy dir in container'",
  "docker inspect 1Panel-openresty-zpMY --format '{{ range .Mounts }}{{ .Source }}:{{ .Destination }}{{ printf \"\\n\" }}{{ end }}'",
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
