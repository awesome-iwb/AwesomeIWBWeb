const { Client } = require("ssh2");
const fs = require("fs");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

const uploads = [
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\index.ts", remote: "/opt/awesomeiwb/backend/src/index.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\backend\\src\\services\\capabilities.ts", remote: "/opt/awesomeiwb/backend/src/services/capabilities.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\frontend\\src\\views\\AdminView.vue", remote: "/opt/awesomeiwb/frontend/src/views/AdminView.vue" },
  { local: "d:\\github\\AwesomeIWBWeb\\deploy\\systemd\\awesomeiwb-backend.service", remote: "/etc/systemd/system/awesomeiwb-backend.service" },
  { local: "d:\\github\\AwesomeIWBWeb\\deploy\\docker-compose.yml", remote: "/opt/awesomeiwb/deploy/docker-compose.yml" },
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

  console.log("\nRunning deployment commands...");
  const commands = [
    "systemctl daemon-reload",
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun install --production",
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate",
    "systemctl restart awesomeiwb-backend",
    "sleep 3",
    "systemctl status awesomeiwb-backend --no-pager | head -10",
    "curl -s http://127.0.0.1:8080/api/health",
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun install",
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build 2>&1 | tail -10",
    "rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/",
    "nginx -t && systemctl reload nginx",
    "curl -s http://127.0.0.1/api/health",
    "echo '=== Deployment Complete ==='",
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
