const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected! Running diagnostics...\n");

  const commands = [
    "echo '=== 1. Backend status ===' && systemctl status awesomeiwb-backend --no-pager | head -6",
    "echo '=== 2. Backend log (last 10) ===' && tail -10 /var/log/awesomeiwb/backend.log",
    "echo '=== 3. Backend errors ===' && tail -5 /var/log/awesomeiwb/backend.err.log",
    "echo '=== 4. API /auth/login ===' && curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/auth/login 2>&1 | head -c 300",
    "echo '' && echo '=== 5. API /capabilities ===' && curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/capabilities 2>&1 | head -c 300",
    "echo '' && echo '=== 6. API /auth/me (no auth) ===' && curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8081/api/auth/me 2>&1",
    "echo '=== 7. DB connection test ===' && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT count(*) as c FROM users\\`.then(r=>console.log('Users count:', r.rows[0].c)).catch(e=>console.error('DB ERROR:', e.message))\" 2>&1",
    "echo '=== 8. Check capabilities table ===' && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT id FROM capabilities ORDER BY sort_index\\`.then(r=>console.log('Capabilities:', r.rows.map(x=>x.id).join(', '))).catch(e=>console.error('DB ERROR:', e.message))\" 2>&1",
    "echo '=== 9. Check user:delete capability ===' && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT id FROM capabilities WHERE id='user:delete'\\`.then(r=>console.log('user:delete found:', r.rows.length > 0)).catch(e=>console.error('DB ERROR:', e.message))\" 2>&1",
    "echo '=== 10. Frontend dist check ===' && ls -la /var/www/awesomeiwb/dist/ | head -10",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Diagnostics complete ==="); conn.end(); return; }
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
