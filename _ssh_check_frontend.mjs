import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Test story cover image ==="',
    'curl -sI "http://127.0.0.1:8081/api/stories/feature-classisland/cover.webp" | head -10',
    'echo ""',
    'echo "=== Check story files ==="',
    'ls -la /opt/awesomeiwb/backend/stories/feature-classisland/',
    'echo ""',
    'echo "=== Test project detail with Chinese name ==="',
    'curl -s "http://127.0.0.1:8081/api/projects/360%E6%8B%96%E5%A0%82%E5%8D%AB%E5%A3%AB" | head -c 300',
    'echo ""',
    'echo "=== Test catalog API (homepage) ==="',
    'curl -s "http://127.0.0.1:8081/api/projects" | head -c 300',
    'echo ""',
    'echo "=== Check nginx config ==="',
    'cat /etc/nginx/sites-enabled/* 2>/dev/null || cat /etc/nginx/conf.d/*.conf 2>/dev/null || echo "No nginx config found"',
    'echo ""',
    'echo "=== Check if frontend is served ==="',
    'curl -sI "http://210.16.165.251/" | head -5',
    'echo ""',
    'echo "=== Check frontend build ==="',
    'ls -la /opt/awesomeiwb/frontend/dist/ 2>/dev/null | head -10 || echo "No frontend dist"',
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
