import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check iptables ===" && iptables -L -n 2>/dev/null | head -20 && echo "" && echo "=== Check ufw ===" && ufw status 2>/dev/null && echo "" && echo "=== Check if port 8080 is accessible externally ===" && ss -tlnp | grep 8080 && echo "" && echo "=== Test API response with curl from external IP ===" && curl -s -w "HTTP_CODE: %{http_code}\\n" "http://210.16.165.251:8080/api/projects" -o /dev/null && echo "" && echo "=== Check nginx access log for recent 4xx/5xx ===" && tail -50 /var/log/nginx/access.log | grep -E " [45][0-9][0-9] " | tail -10`;

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
