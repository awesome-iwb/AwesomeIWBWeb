const { Client } = require("ssh2");
const fs = require("fs");
const conn = new Client();

conn.on("ready", async () => {
  console.log("Connected! Uploading fixed files via SFTP...");

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  const uploads = [
    {
      local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\plugins\\casdoorAuth.ts",
      remote: "/opt/awesomeiwb/backend/src/plugins/casdoorAuth.ts",
    },
    {
      local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\config.ts",
      remote: "/opt/awesomeiwb/backend/src/config.ts",
    },
  ];

  for (const { local, remote } of uploads) {
    console.log(`Uploading ${local} -> ${remote}`);
    await new Promise((resolve, reject) => {
      const rs = fs.createReadStream(local);
      const ws = sftp.createWriteStream(remote);
      ws.on("close", resolve);
      ws.on("error", reject);
      rs.on("error", reject);
      rs.pipe(ws);
    });
    console.log("  Done!");
  }

  console.log("\nVerifying uploaded files...");
  const commands = [
    "grep 'CASDOOR_APPLICATION' /opt/awesomeiwb/backend/src/plugins/casdoorAuth.ts",
    "grep 'application' /opt/awesomeiwb/backend/src/config.ts | head -3",
    "systemctl restart awesomeiwb-backend",
    "sleep 4",
    "curl -s https://aiwb.smart-teach.cn/api/auth/login 2>&1",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== All done! ==="); conn.end(); return; }
    console.log(`\n[${i + 1}/${commands.length}] ${commands[i].substring(0, 70)}`);
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
  readyTimeout: 60000, keepaliveInterval: 10000,
});
