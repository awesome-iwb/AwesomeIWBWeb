const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("Connected! Deep DB diagnostics...\n");

  const commands = [
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT count(*) as c FROM users\\`.then(r=>console.log('Users:', r.rows[0].c)).catch(e=>console.error('DB ERROR:', e.message))\" 2>&1",
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT id FROM capabilities ORDER BY sort_index\\`.then(r=>console.log('Caps:', r.rows.map(x=>x.id).join(', '))).catch(e=>console.error('DB ERROR:', e.message))\" 2>&1",
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {sql}=require('./src/db/client');sql\\`SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5\\`.then(r=>console.log('Migrations:', JSON.stringify(r.rows))).catch(e=>console.error('DB ERROR:', e.message))\" 2>&1",
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {userHasCapability}=require('./src/services/capabilities');userHasCapability('admin','admin_panel_access').then(r=>console.log('admin has admin_panel_access:',r)).catch(e=>console.error('CAP ERROR:', e.message))\" 2>&1",
    "export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && /usr/local/bin/bun -e \"const {getUserCapabilitiesWithInfo}=require('./src/services/capabilities');getUserCapabilitiesWithInfo('admin','admin').then(r=>console.log('admin caps:', JSON.stringify(r))).catch(e=>console.error('CAP ERROR:', e.message))\" 2>&1",
    "sed -n '1,30p' /opt/awesomeiwb/backend/src/services/capabilities.ts",
    "sed -n '85,115p' /opt/awesomeiwb/backend/src/services/capabilities.ts",
  ];

  let i = 0;
  function runNext() {
    if (i >= commands.length) { console.log("\n=== Done ==="); conn.end(); return; }
    console.log(`\n[${i + 1}]`);
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
