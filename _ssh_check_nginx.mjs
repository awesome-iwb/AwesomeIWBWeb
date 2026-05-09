import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Test via nginx (port 8080) ==="',
    'curl -s "http://127.0.0.1:8080/api/projects/Ink%20Canvas" | head -c 300',
    'echo ""',
    'echo "=== Test via external IP ==="',
    'curl -s "http://210.16.165.251:8080/api/projects/Ink%20Canvas" | head -c 300',
    'echo ""',
    'echo "=== Check frontend env config ==="',
    'cat /var/www/awesomeiwb/dist/assets/*.js 2>/dev/null | grep -o "VITE_API_BASE_URL[^,]*" | head -5 || echo "No VITE_API_BASE_URL found"',
    'echo ""',
    'echo "=== Check nginx error log ==="',
    'tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No nginx error log"',
    'echo ""',
    'echo "=== Check nginx access log for recent project API calls ==="',
    'tail -30 /var/log/nginx/access.log 2>/dev/null | grep "api/projects" || echo "No project API calls in access log"',
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
