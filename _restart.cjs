const { Client } = require("ssh2");
const conn = new Client();
const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";
conn.on("ready", () => {
  console.log("Connected!");
  const commands = [
    "systemctl restart awesomeiwb-backend",
    "sleep 2",
    "systemctl status awesomeiwb-backend | head -10",
    "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health",
  ];
  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\nDone!"); conn.end(); return; }
    console.log(`\n[${i + 1}] ${commands[i].substring(0, 80)}`);
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
