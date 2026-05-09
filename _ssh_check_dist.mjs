import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "=== List all HTML files in dist ==="',
    'ls -la /var/www/awesomeiwb/dist/*.html',
    'echo ""',
    'echo "=== Check dist index.html for JS bundle references ==="',
    'grep -o "src=\\"[^\\"]*\\"" /var/www/awesomeiwb/dist/index.html | head -10',
    'echo ""',
    'echo "=== Check when dist was last built ==="',
    'stat /var/www/awesomeiwb/dist/index.html | grep Modify',
    'echo ""',
    'echo "=== Test API response time ==="',
    'time curl -s "http://127.0.0.1:8081/api/projects" -o /dev/null 2>&1',
    'echo ""',
    'echo "=== Test project detail API with various names ==="',
    'curl -s "http://127.0.0.1:8081/api/projects/ICC-CE" | head -c 200',
    'echo ""',
    'curl -s "http://127.0.0.1:8081/api/projects/Ink%20Canvas" | head -c 200',
    'echo ""',
    'echo "=== Check if there are CORS issues ==="',
    'curl -sI "http://210.16.165.251:8080/api/projects" -H "Origin: http://210.16.165.251:8080" | grep -i "access-control\\|content-type"',
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
