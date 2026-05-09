import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Test project detail API response for ICC-CE ==="',
    'curl -s "http://127.0.0.1:8081/api/projects/ICC-CE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({k:type(v).__name__ for k,v in d.items()}, indent=2))" 2>/dev/null || echo "Parse failed"',
    'echo ""',
    'echo "=== Check if any project has invalid extra field ==="',
    'export $(grep -v "^#" /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && bun -e "
import { sql } from \\"./src/db/client\\";
const db = sql();
const rows = await db\\\`select name, extra from projects where extra is not null and extra != \\\\\\'{}\\\\\\' limit 5\\\`;
for (const r of rows) {
  const extra = r.extra;
  console.log(r.name, \\"extra type:\\", typeof extra, \\"keys:\\", Object.keys(extra || {}).join(\\\\\\',\\\\\\'));
}
await db.end();
" 2>&1',
    'echo ""',
    'echo "=== Check normalizeProjectTags behavior ==="',
    'export $(grep -v "^#" /etc/awesomeiwb/backend.env | xargs) && cd /opt/awesomeiwb/backend && bun -e "
import { sql } from \\"./src/db/client\\";
import { normalizeProjectTags } from \\"./src/domain/projectTags\\";
const db = sql();
const rows = await db\\\`select * from projects limit 3\\\`;
for (const r of rows) {
  const normalized = normalizeProjectTags(r);
  console.log(r.name, \\"keywords before:\\", JSON.stringify(r.keywords), \\"after:\\", JSON.stringify(normalized.keywords));
}
await db.end();
" 2>&1',
  ];

  const cmd = commands.join(' && ') + ' 2>&1';

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
