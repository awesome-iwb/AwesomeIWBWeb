const { Client } = require("ssh2");
const conn = new Client();
const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";
conn.on("ready", () => {
  console.log("Connected!");
  conn.exec("cd /opt/awesomeiwb/backend && /usr/local/bin/bun run src/index.ts 2>&1 &  sleep 3 && kill %1 2>/dev/null; wait 2>/dev/null", (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", () => { conn.end(); });
  });
}).on("error", (err) => console.error("Error:", err));
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
