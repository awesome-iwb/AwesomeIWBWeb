import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== Check frontend HTML for project detail route ==="',
    'curl -s "http://127.0.0.1:8080/project/ICC-CE" | head -30',
    'echo ""',
    'echo "=== Check if JS bundle loads ==="',
    'curl -sI "http://127.0.0.1:8080/project/ICC-CE" | head -10',
    'echo ""',
    'echo "=== Check if there are JS errors in the built bundle ==="',
    'ls -la /var/www/awesomeiwb/dist/assets/*.js | head -5',
    'echo ""',
    'echo "=== Check the built index.html ==="',
    'head -30 /var/www/awesomeiwb/dist/index.html',
    'echo ""',
    'echo "=== Check project.html (if exists) ==="',
    'head -30 /var/www/awesomeiwb/dist/project.html 2>/dev/null || echo "No project.html"',
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
