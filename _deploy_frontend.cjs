const { Client } = require("ssh2");
const fs = require("fs");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

const uploads = [
  { local: "d:\\github\\AwesomeIWBWeb\\frontend\\src\\composables\\useAuth.ts", remote: "/opt/awesomeiwb/frontend/src/composables/useAuth.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\frontend\\src\\content\\friendLinks.ts", remote: "/opt/awesomeiwb/frontend/src/content/friendLinks.ts" },
  { local: "d:\\github\\AwesomeIWBWeb\\frontend\\src\\views\\AdminView.vue", remote: "/opt/awesomeiwb/frontend/src/views/AdminView.vue" },
  { local: "d:\\github\\AwesomeIWBWeb\\frontend\\src\\views\\DevView.vue", remote: "/opt/awesomeiwb/frontend/src/views/DevView.vue" },
];

conn.on("ready", async () => {
  console.log("Connected! Uploading frontend files...");

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

  console.log("\nBuilding frontend...");
  const commands = [
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build 2>&1 | tail -20",
    "rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/",
    "echo 'Frontend deployed!'",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Frontend deployment complete! ==="); conn.end(); return; }
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
