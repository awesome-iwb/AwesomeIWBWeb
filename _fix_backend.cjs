const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected!");

  const commands = [
    "systemctl stop awesomeiwb-backend",
    "lsof -i :8081 || ss -tlnp | grep 8081 || echo 'port 8081 free'",
    "fuser -k 8081/tcp 2>/dev/null; echo 'killed old processes'",
    "sleep 1",
    "systemctl start awesomeiwb-backend",
    "sleep 4",
    "systemctl status awesomeiwb-backend --no-pager -l",
    "tail -10 /var/log/awesomeiwb/backend.err.log",
    "tail -10 /var/log/awesomeiwb/backend.log",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) {
      console.log("\n=== Done ===");
      conn.end();
      return;
    }
    const label = `[${i + 1}/${commands.length}]`;
    console.log(`\n${label} ${commands[i].substring(0, 80)}`);
    conn.exec(commands[i], (err, stream) => {
      if (err) {
        console.error(`Error:`, err);
        i++;
        runNext();
        return;
      }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", () => {
        i++;
        runNext();
      });
    });
  }

  runNext();
}).on("error", (err) => {
  console.error("Connection error:", err);
});

conn.connect({
  host: "210.16.165.251",
  port: 22,
  username: "root",
  password: "8EGZ4jf3vumREH",
  readyTimeout: 60000,
  keepaliveInterval: 10000,
});
