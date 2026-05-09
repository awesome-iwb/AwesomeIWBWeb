import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Full page load test ===" && curl -s -w "\\nHTTP_CODE: %{http_code}\\nTIME_TOTAL: %{time_total}s\\nSIZE_DOWNLOAD: %{size_download}\\n" "http://210.16.165.251:8080/project/ICC-CE" -o /dev/null && echo "" && echo "=== Check if project.html exists ===" && ls -la /var/www/awesomeiwb/dist/project.html 2>/dev/null || echo "No project.html" && echo "" && echo "=== Check all HTML files ===" && ls /var/www/awesomeiwb/dist/*.html && echo "" && echo "=== Check ViteSSG routes config ===" && grep -A20 "ssg\\|includedRoutes\\|routes" /opt/awesomeiwb/frontend/vite.config.ts | head -30`;

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
