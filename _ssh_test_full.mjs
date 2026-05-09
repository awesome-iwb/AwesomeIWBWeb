import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Test full /api/projects response structure ==="',
    'curl -s "http://127.0.0.1:8081/api/projects" | python3 -c "
import sys, json
data = json.load(sys.stdin)
cats = data.get(\'categories\', [])
print(f\'Total categories: {len(cats)}\')
total = 0
for c in cats:
    projs = c.get(\'projects\', [])
    total += len(projs)
    print(f\'  {c[\"name\"]}: {len(projs)} projects\')
print(f\'Total projects: {total}\')
" 2>&1',
    'echo ""',
    'echo "=== Test /api/projects/ICC-CE response ==="',
    'curl -s "http://127.0.0.1:8081/api/projects/ICC-CE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\'Name: {data.get(\"name\")}\')
print(f\'Keywords: {data.get(\"keywords\")}\')
print(f\'Category ID: {data.get(\"category_id\")}\')
print(f\'Has releases: {\"releases\" in data}\')
print(f\'Extra keys: {list(data.get(\"extra\", {}).keys())}\')
" 2>&1',
    'echo ""',
    'echo "=== Test story cover image endpoint ==="',
    'curl -sI "http://127.0.0.1:8081/api/stories/feature-classisland/cover.webp" | head -5',
    'echo ""',
    'echo "=== Check storyFileAllowlist in current index.ts ==="',
    'grep "storyFileAllowlist" /opt/awesomeiwb/backend/src/index.ts',
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
