const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected! Running migration via systemd env...");

  const commands = [
    "source /etc/awesomeiwb/backend.env && cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate 2>&1",
    "systemctl restart awesomeiwb-backend",
    "sleep 4",
    "tail -5 /var/log/awesomeiwb/backend.log",
    "curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/auth/login 2>&1",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Done ==="); conn.end(); return; }
    console.log(`\n[${i + 1}/${commands.length}]`);
    conn.exec(commands[i], (err, stream) => {
      if (err) { console.error(err); i++; runNext(); return; }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", () => { i++; runNext(); });
    });
  }
  runNext();
}).on("error", (err) => console.error("Error:", err));

conn.connect({ host: "210.16.165.251", port: 22, username: "root", password: "8EGZ4jf3vumREH", readyTimeout: 60000 });
