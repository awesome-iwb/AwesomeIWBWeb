const { Client } = require("ssh2");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

conn.on("ready", () => {
  console.log("Connected to server!");

  const commands = [
    "sed -i 's|CASDOOR_REDIRECT_URI=http://aiwb|CASDOOR_REDIRECT_URI=https://aiwb|' /etc/awesomeiwb/backend.env",
    "sed -i 's|FRONTEND_URL=http://aiwb|FRONTEND_URL=https://aiwb|' /etc/awesomeiwb/backend.env",
    "grep -E 'CASDOOR_REDIRECT_URI|FRONTEND_URL' /etc/awesomeiwb/backend.env",
    "cd /opt/awesomeiwb && git fetch origin && git reset --hard origin/main",
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun install --production",
    "cd /opt/awesomeiwb/backend && /usr/local/bin/bun run migrate",
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun install",
    "cd /opt/awesomeiwb/frontend && /usr/local/bin/bun run build",
    "rsync -a --delete /opt/awesomeiwb/frontend/dist/ /var/www/awesomeiwb/dist/",
    "systemctl restart awesomeiwb-backend",
    "sleep 3 && systemctl status awesomeiwb-backend --no-pager -l",
    "curl -s -o /dev/null -w '%{http_code}' https://aiwb.smart-teach.cn/api/projects/ICC-CE",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) {
      console.log("\n=== All commands completed! ===");
      conn.end();
      return;
    }
    const cmd = commands[i];
    console.log(`\n[${i + 1}/${commands.length}] ${cmd.substring(0, 80)}...`);
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(`Error on command ${i + 1}:`, err);
        conn.end();
        return;
      }
      let stdout = "";
      let stderr = "";
      stream.on("data", (d) => {
        stdout += d.toString();
        process.stdout.write(d.toString());
      });
      stream.stderr.on("data", (d) => {
        stderr += d.toString();
        process.stderr.write(d.toString());
      });
      stream.on("close", (code) => {
        if (code !== 0 && i < 3) {
          console.log(`  (exit code: ${code})`);
        }
        i++;
        runNext();
      });
    });
  }

  runNext();
}).on("error", (err) => {
  console.error("Connection error:", err);
});

conn.connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 60000,
  keepaliveInterval: 10000,
});
