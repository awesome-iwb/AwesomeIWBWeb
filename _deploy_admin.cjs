const { Client } = require("ssh2");
const fs = require("fs");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

const uploads = [
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\services\\capabilities.ts", remote: "/opt/awesomeiwb/backend/src/services/capabilities.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\services\\users.ts", remote: "/opt/awesomeiwb/backend/src/services/users.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\index.ts", remote: "/opt/awesomeiwb/backend/src/index.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\migrations\\0017_add_user_delete_capability.sql", remote: "/opt/awesomeiwb/backend/migrations/0017_add_user_delete_capability.sql" },
  { local: "d:\\github\\AwesomeIWBWeb\\frontend\\src\\views\\AdminView.vue", remote: "/opt/awesomeiwb/frontend/src/views/AdminView.vue" },
];

conn.on("ready", async () => {
  console.log("Connected! Uploading files...");

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

  console.log("\nRunning migration, restarting backend, building frontend...");
  const commands = [
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate 2>&1 | tail -5",
    "systemctl restart awesomeiwb-backend",
    "sleep 4",
    "systemctl status awesomeiwb-backend --no-pager | head -8",
    "tail -3 /var/log/awesomeiwb/backend.log",
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build 2>&1 | tail -5",
    "rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/",
    "echo '=== Deployment complete! ==='",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { conn.end(); return; }
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
