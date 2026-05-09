import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Test story cover image ===" && curl -sI "http://127.0.0.1:8081/api/stories/feature-classisland/cover.webp" | head -5 && echo "" && echo "=== Test project keywords ===" && curl -s "http://127.0.0.1:8081/api/projects/ICC-CE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Name: {d[\"name\"]}, Keywords: {d.get(\"keywords\",[])}')" 2>&1 && echo "" && echo "=== Test project detail API ===" && curl -s "http://127.0.0.1:8081/api/projects/ICC-CE" | head -c 200 && echo "" && echo "=== Test all projects count ===" && curl -s "http://127.0.0.1:8081/api/projects" | python3 -c "import sys,json; d=json.load(sys.stdin); total=sum(len(c.get('projects',[])) for c in d.get('categories',[])); print(f'Total projects: {total}')" 2>&1`;

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
