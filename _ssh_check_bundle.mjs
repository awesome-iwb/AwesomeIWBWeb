import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check JS bundle timestamp ===" && ls -la /var/www/awesomeiwb/dist/assets/*.js | head -5 && echo "" && echo "=== Check JS bundle for fetchProjectByName ===" && grep -l "fetchProjectByName" /var/www/awesomeiwb/dist/assets/*.js && echo "" && echo "=== Check if JS bundle references correct API path ===" && grep -o "api/projects" /var/www/awesomeiwb/dist/assets/*.js | head -5 && echo "" && echo "=== Check git log for recent frontend changes ===" && cd /opt/awesomeiwb/frontend && git log --oneline -5 2>/dev/null || echo "Not a git repo" && echo "" && echo "=== Check if there is a newer build needed ===" && cd /opt/awesomeiwb/backend && git log --oneline -5 2>/dev/null || echo "Not a git repo"`;

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
