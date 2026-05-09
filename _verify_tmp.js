const { Client } = require("ssh2");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (d) => { stdout += d.toString(); });
      stream.stderr.on("data", (d) => { stderr += d.toString(); });
      stream.on("close", (code) => resolve({ stdout, stderr, code }));
    });
  });
}

async function main() {
  console.log("=== Connecting to server ===");
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve);
    conn.on("error", reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
  });
  console.log("Connected!\n");

  const commands = [
    {
      label: "1. Docker containers status",
      cmd: `docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"`,
    },
    {
      label: "2. Backend container logs (last 10)",
      cmd: `docker logs awesomeiwb-backend --tail 10`,
    },
    {
      label: "3. Postgres container logs (last 5)",
      cmd: `docker logs awesomeiwb-pg --tail 5`,
    },
    {
      label: "4a. Test homepage",
      cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/`,
    },
    {
      label: "4b. Test project page",
      cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/project/ICC-CE`,
    },
    {
      label: "4c. Test API projects",
      cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/projects`,
    },
    {
      label: "4d. Test story cover image",
      cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/stories/feature-classisland/cover.webp`,
    },
    {
      label: "4e. Test /today",
      cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/today`,
    },
    {
      label: "5. Test external access",
      cmd: `curl -s -o /dev/null -w "%{http_code}" http://210.16.165.251:8080/api/projects/ICC-CE`,
    },
    {
      label: "6. 1Panel status",
      cmd: `systemctl status 1panel | head -5`,
    },
    {
      label: "7. Check old systemd service",
      cmd: `systemctl is-enabled awesomeiwb-backend`,
    },
    {
      label: "8. Docker container resource usage",
      cmd: `docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}"`,
    },
  ];

  for (const { label, cmd } of commands) {
    console.log(`=== ${label} ===`);
    console.log(`$ ${cmd}`);
    const { stdout, stderr, code } = await exec(cmd);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.log(`[stderr] ${stderr.trim()}`);
    console.log(`[exit code: ${code}]\n`);
  }

  conn.end();
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  conn.end();
  process.exit(1);
});
