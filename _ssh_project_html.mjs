import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check ICC-CE project page ===" && ls -la "/var/www/awesomeiwb/dist/project/ICC-CE.html" 2>/dev/null || echo "ICC-CE.html not found" && echo "" && echo "=== List all project HTML files ===" && ls /var/www/awesomeiwb/dist/project/ | head -20 && echo "" && echo "=== Check ICC-CE HTML content ===" && head -50 "/var/www/awesomeiwb/dist/project/ICC-CE.html" 2>/dev/null || echo "File not found"`;

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
