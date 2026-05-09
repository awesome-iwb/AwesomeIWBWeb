import { Client } from 'ssh2';

const conn = new Client();

const testScript = `
import { sql } from "/opt/awesomeiwb/backend/src/db/client";
import { normalizeProjectTags } from "/opt/awesomeiwb/backend/src/domain/projectTags";

const db = sql();
const rows = await db\`select * from projects limit 5\`;
for (const r of rows) {
  const normalized = normalizeProjectTags(r);
  console.log(r.name, "keywords before:", JSON.stringify(r.keywords?.slice(0,3)), "after:", JSON.stringify(normalized.keywords?.slice(0,3)));
}
await db.end();
`;

conn.on('ready', () => {
  const b64 = Buffer.from(testScript).toString('base64');
  const cmd = `echo "${b64}" | base64 -d > /tmp/test_normalize.ts && export $(grep -v '^#' /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && bun run /tmp/test_normalize.ts 2>&1`;

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
