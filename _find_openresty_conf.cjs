const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  "cat /proc/1557781/cmdline | tr '\\0' ' '",
  "ls -la /proc/1557781/fd/ | grep conf",
  "find / -name 'nginx.conf' -path '*openresty*' 2>/dev/null",
  "find /etc -name '*openresty*' 2>/dev/null | head -10",
  "ss -tlnp | grep -E '80|443'",
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
