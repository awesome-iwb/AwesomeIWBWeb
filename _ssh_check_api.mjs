import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Test project detail API ==="',
    'curl -s "http://127.0.0.1:8081/api/projects/Ink%20Canvas" | head -c 500',
    'echo ""',
    'echo "=== Test project detail API with slug ==="',
    'curl -s "http://127.0.0.1:8081/api/projects/ink-canvas-artistry" | head -c 500',
    'echo ""',
    'echo "=== Test stories API ==="',
    'curl -s "http://127.0.0.1:8081/api/stories" | head -c 500',
    'echo ""',
    'echo "=== Check stories directory ==="',
    'ls -la /opt/awesomeiwb/backend/stories/ 2>/dev/null || echo "No stories dir"',
    'echo ""',
    'echo "=== Check uploads directory ==="',
    'ls -la /opt/awesomeiwb/backend/runtime/uploads/ 2>/dev/null | head -10 || echo "No uploads dir"',
    'echo ""',
    'echo "=== Check backend journal for errors ==="',
    'journalctl -u awesomeiwb-backend --no-pager -n 20 2>&1',
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
