const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected!");

  const commands = [
    "sed -i 's|CASDOOR_APPLICATION_NAME=awesome-iwb|CASDOOR_APPLICATION_NAME=AIWB|' /etc/awesomeiwb/backend.env",
    "grep CASDOOR_APPLICATION_NAME /etc/awesomeiwb/backend.env",
    "cd /opt/awesomeiwb && git fetch origin && git reset --hard origin/main",
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun install --production",
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun install && /usr/local/bin/bun run build",
    "rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/",
    "systemctl restart awesomeiwb-backend",
    "sleep 4",
    "systemctl status awesomeiwb-backend --no-pager -l | head -15",
    "tail -3 /var/log/awesomeiwb/backend.log",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) {
      console.log("\n=== Done ===");
      conn.end();
      return;
    }
    console.log(`\n[${i + 1}/${commands.length}] ${commands[i].substring(0, 80)}`);
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
  host: "210.16.165.251",
  port: 22,
  username: "root",
  password: "8EGZ4jf3vumREH",
  readyTimeout: 60000,
  keepaliveInterval: 10000,
});
