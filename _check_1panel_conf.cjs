const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  "cat /opt/1panel/apps/openresty/openresty/conf/nginx.conf",
  "ls -la /opt/1panel/apps/openresty/openresty/conf/",
  "ls -la /opt/1panel/apps/openresty/openresty/conf/conf.d/ 2>/dev/null || echo 'no conf.d'",
  "cat /opt/1panel/apps/openresty/openresty/conf/conf.d/* 2>/dev/null | head -80",
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
