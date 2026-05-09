import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check SSG build env ===" && cat /opt/awesomeiwb/frontend/.env.production 2>/dev/null || echo "No .env.production" && echo "" && echo "=== Check frontend package.json for build script ===" && grep -A5 '"build"' /opt/awesomeiwb/frontend/package.json 2>/dev/null && echo "" && echo "=== Check if there is a Vite config ===" && ls -la /opt/awesomeiwb/frontend/vite.config.* 2>/dev/null && echo "" && echo "=== Check frontend build log ===" && ls -la /var/www/awesomeiwb/dist/ | head -10`;

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
