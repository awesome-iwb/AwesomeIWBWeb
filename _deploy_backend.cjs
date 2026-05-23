const { Client } = require("ssh2");
const fs = require("fs");
const conn = new Client();
const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";
conn.on("ready", async () => {
  console.log("Connected!");
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  const uploads = [
    { local: "d:\\github\\AwesomeIWBWeb\\backend\\migrations\\0033_create_pages.sql", remote: "/opt/awesomeiwb/backend/migrations/0033_create_pages.sql" },
    { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\services\\pages.ts", remote: "/opt/awesomeiwb/backend/src/services/pages.ts" },
  ];

  for (const { local, remote } of uploads) {
    const fileName = local.split("\\").pop();
    console.log(`Uploading ${fileName}...`);
    await new Promise((resolve, reject) => {
      const rs = fs.createReadStream(local);
      const ws = sftp.createWriteStream(remote);
      ws.on("close", resolve);
      ws.on("error", reject);
      rs.on("error", reject);
      rs.pipe(ws);
    });
    console.log(`  Done!`);
  }

  const commands = [
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun run src/db/migrate.ts 2>&1",
    "cd /opt/awesomeiwb && supervisorctl restart all 2>&1 || systemctl restart awesomeiwb 2>&1 || echo 'restart skipped'",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\nBackend deployed!"); conn.end(); return; }
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
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
