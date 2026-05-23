const { Client } = require("ssh2");
const conn = new Client();
const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";
conn.on("ready", () => {
  console.log("Connected!");
  const commands = [
    "ps aux | grep -i bun | grep -v grep",
    "ps aux | grep -i elysia | grep -v grep",
    "ps aux | grep -i node | grep -v grep | head -5",
    "ls /etc/systemd/system/ | grep -i awe",
    "ls /etc/supervisor/conf.d/ 2>/dev/null || echo 'no supervisor conf'",
    "which bun",
  ];
  let i = 0;
  function runNext() {
    if (i >= commands.length) { conn.end(); return; }
    console.log(`\n> ${commands[i]}`);
    conn.exec(commands[i], (err, stream) => {
      if (err) { console.error(err); i++; runNext(); return; }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", () => { i++; runNext(); });
    });
  }
  runNext();
}).on("error", (err) => console.error("Error:", err));
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
