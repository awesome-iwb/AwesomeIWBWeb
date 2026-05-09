import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Categories and project counts ===" && curl -s "http://127.0.0.1:8081/api/projects" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(c['name'],len(c.get('projects',[]))) for c in d.get('categories',[])]" && echo "" && echo "=== Story cover ===" && curl -sI "http://127.0.0.1:8081/api/stories/feature-classisland/cover.webp" | head -5 && echo "" && echo "=== Allowlist ===" && grep "storyFileAllowlist" /opt/awesomeiwb/backend/src/index.ts`;

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
