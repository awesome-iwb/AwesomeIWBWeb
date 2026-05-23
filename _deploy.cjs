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
  const localTar = "d:\\github\\AwesomeIWBWeb\\frontend\\dist.tar.gz";
  const remoteTar = "/tmp/dist.tar.gz";
  console.log("Uploading...");
  await new Promise((resolve, reject) => {
    const rs = fs.createReadStream(localTar);
    const ws = sftp.createWriteStream(remoteTar);
    ws.on("close", resolve);
    ws.on("error", reject);
    rs.on("error", reject);
    rs.pipe(ws);
  });
  console.log("Upload done! Extracting...");
  const commands = [
    "rm -rf /var/www/awesomeiwb/dist/*",
    "tar -xzf /tmp/dist.tar.gz -C /var/www/awesomeiwb/dist/",
    "rm -f /tmp/dist.tar.gz",
    "cd /opt/awesomeiwb && git add -A && git stash",
    "cd /opt/awesomeiwb && git pull origin main 2>&1 || echo 'git pull skipped'",
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun run src/db/migrate.ts 2>&1 || echo 'migration skipped'",
    "cd /opt/awesomeiwb && pm2 restart all 2>&1 || echo 'pm2 restart skipped'",
    "echo 'Deployment complete!'",
  ];
  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\nAll done!"); conn.end(); return; }
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
