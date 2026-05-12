const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected!");

  const commands = [
    "docker ps --format '{{.Names}} {{.Status}}'",
    "curl -s -o /dev/null -w 'API status: %{http_code}' https://aiwb.smart-teach.cn/api/projects/ICC-CE",
    "curl -s https://aiwb.smart-teach.cn/api/auth/login -w '\\nHTTP: %{http_code}' | head -5",
    "curl -s -o /dev/null -w 'Frontend: %{http_code}' https://aiwb.smart-teach.cn/",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) {
      console.log("\n=== Verification complete ===");
      conn.end();
      return;
    }
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

conn.connect({
  host: "210.16.165.251",
  port: 22,
  username: "root",
  password: "8EGZ4jf3vumREH",
  readyTimeout: 30000,
});
