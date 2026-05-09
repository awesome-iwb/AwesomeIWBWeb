import { Client } from 'ssh2';

const conn = new Client();

const testScript = `
import { sql } from "/opt/awesomeiwb/backend/src/db/client";
import { normalizeProjectTags } from "/opt/awesomeiwb/backend/src/domain/projectTags";

const db = sql();
const rows = await db\`select * from projects\`;
let issues = [];
for (const r of rows) {
  const n = normalizeProjectTags(r);
  if (!n.name || n.name.trim() === '') issues.push(r.slug + ": empty name after normalize");
  if (!n.category_id) issues.push(r.slug + ": null category_id");
  if (n.extra && typeof n.extra === 'object') {
    const extraStr = JSON.stringify(n.extra);
    if (extraStr.length > 50000) issues.push(r.slug + ": extra is " + extraStr.length + " chars");
  }
}
if (issues.length === 0) {
  console.log("No issues found in " + rows.length + " projects");
} else {
  for (const i of issues) console.log(i);
}
await db.end();
`;

conn.on('ready', () => {
  const b64 = Buffer.from(testScript).toString('base64');
  const cmd = `echo "${b64}" | base64 -d > /tmp/test_data.ts && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && bun run /tmp/test_data.ts 2>&1`;

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('EXEC ERROR:', err); conn.end(); process.exit(1); }
    let stdout = '', stderr = '';
    stream.on('data', (data) => { stdout += data; });
    stream.stderr.on('data', (data) => { stderr += data; });
    stream.on('close', () => {
      if (stdout) console.log(stdout);
      if (stderr) console.error('STDERR:', stderr);
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('CONN ERROR:', err.message);
  process.exit(1);
}).connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000
});
