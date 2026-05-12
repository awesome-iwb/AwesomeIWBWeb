const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected! Running migration with explicit env...");

  const commands = [
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate 2>&1",
    "psql -U awesomeiwb -d awesomeiwb -h 127.0.0.1 -c \"\\d users\" 2>&1 | grep -E 'hzzc|sectl|lincube' || echo 'columns checked'",
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
