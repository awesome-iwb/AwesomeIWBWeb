const { Client } = require("ssh2");
const fs = require("fs");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

const uploads = [
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\plugins\\casdoorAuth.ts", remote: "/opt/awesomeiwb/backend/src/plugins/casdoorAuth.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\services\\users.ts", remote: "/opt/awesomeiwb/backend/src/services/users.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\domain\\normalizeProjectInput.ts", remote: "/opt/awesomeiwb/backend/src/domain/normalizeProjectInput.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\domain\\normalizeProjectInput.test.ts", remote: "/opt/awesomeiwb/backend/src/domain/normalizeProjectInput.test.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\migrations\\0016_drop_sectl_lincube_add_hzzc.sql", remote: "/opt/awesomeiwb/backend/migrations/0016_drop_sectl_lincube_add_hzzc.sql" },
];

conn.on("ready", async () => {
  console.log("Connected!");

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  for (const { local, remote } of uploads) {
    console.log(`Uploading ${local.split("\\").pop()} -> ${remote}`);
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

  console.log("\nRunning migration and restarting backend...");
  const commands = [
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate 2>&1 || echo 'migration attempted'",
    "systemctl restart awesomeiwb-backend",
    "sleep 4",
    "systemctl status awesomeiwb-backend --no-pager | head -10",
    "tail -5 /var/log/awesomeiwb/backend.log",
    "tail -3 /var/log/awesomeiwb/backend.err.log",
    "curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/auth/login 2>&1",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Deployment complete! ==="); conn.end(); return; }
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

conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
