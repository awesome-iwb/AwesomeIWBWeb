import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check nginx config ===" && cat /etc/nginx/conf.d/*.conf 2>/dev/null && echo "" && echo "=== Check if there is a separate nginx sites config ===" && cat /etc/nginx/sites-enabled/* 2>/dev/null && echo "" && echo "=== Check nginx main config ===" && grep -r "awesomeiwb\\|8080\\|8081" /etc/nginx/ 2>/dev/null | head -20`;

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
