const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected!");

  const commands = [
    "grep CASDOOR_APPLICATION_NAME /etc/awesomeiwb/backend.env",
    "grep 'CASDOOR_APPLICATION' /opt/awesomeiwb/backend/src/plugins/casdoorAuth.ts",
    "grep 'application' /opt/awesomeiwb/backend/src/config.ts | head -3",
    "curl -s https://aiwb.smart-teach.cn/api/auth/login 2>&1 | head -5",
    "systemctl status awesomeiwb-backend --no-pager | head -10",
    "tail -5 /var/log/awesomeiwb/backend.err.log",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Done ==="); conn.end(); return; }
    console.log(`\n--- [${i + 1}/${commands.length}] ---`);
    conn.exec(commands[i], (err, stream) => {
      if (err) { console.error(err); i++; runNext(); return; }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", () => { i++; runNext(); });
    });
  }
  runNext();
}).on("error", (err) => console.error("Error:", err));

conn.connect({
  host: "210.16.165.251", port: 22, username: "root", password: "8EGZ4jf3vumREH",
  readyTimeout: 30000,
});
