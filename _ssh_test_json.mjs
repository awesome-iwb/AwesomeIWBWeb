import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Test /api/projects response validity ==="',
    'curl -s "http://127.0.0.1:8081/api/projects" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\'Categories: {len(d.get(\"categories\",[]))}\'); [print(f\'  {c[\"name\"]}: {len(c.get(\"projects\",[]))} projects\') for c in d.get(\'categories\',[])]" 2>&1 || echo "JSON PARSE FAILED"',
    'echo ""',
    'echo "=== Check for null bytes or invalid characters ==="',
    'curl -s "http://127.0.0.1:8081/api/projects" | python3 -c "import sys; data=sys.stdin.read(); print(f\'Length: {len(data)}\'); print(f\'Has null bytes: {chr(0) in data}\'); print(f\'First 100 chars: {repr(data[:100])}\')" 2>&1',
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
