const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected! Deep DB diagnostics...\n");

  const commands = [
    "echo '=== DB env vars ===' && grep DATABASE_URL /etc/awesomeiwb/backend.env",
    "echo '=== Test DB with psql ===' && export PGPASSWORD=$(grep DB_PASSWORD /etc/awesomeiwb/backend.env | cut -d= -f2) && psql -h 127.0.0.1 -U awesome_iwb -d awesome_iwb -c 'SELECT count(*) FROM users;' 2>&1",
    "echo '=== Backend code check: userHasCapability ===' && sed -n '90,110p' /opt/awesomeiwb/backend/src/services/capabilities.ts",
    "echo '=== Backend code check: getUserCapabilitiesWithInfo ===' && sed -n '50,90p' /opt/awesomeiwb/backend/src/services/capabilities.ts",
    "echo '=== Check if 0017 migration ran ===' && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5\\`.then(r=>console.log(r.rows)).catch(e=>console.error(e.message))\" 2>&1",
    "echo '=== Test userHasCapability directly ===' && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {userHasCapability}=require('./src/services/capabilities');userHasCapability('admin','admin_panel_access').then(r=>console.log('admin has admin_panel_access:',r)).catch(e=>console.error(e.message))\" 2>&1",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Done ==="); conn.end(); return; }
    console.log(`\n${commands[i].split('&&')[0].trim()}`);
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
