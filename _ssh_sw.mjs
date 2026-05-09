import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check Service Worker files ===" && ls -la /var/www/awesomeiwb/dist/sw.js /var/www/awesomeiwb/dist/workbox*.js 2>/dev/null || echo "No SW files" && echo "" && echo "=== Check registerSW.js ===" && cat /var/www/awesomeiwb/dist/registerSW.js 2>/dev/null && echo "" && echo "=== Check manifest.webmanifest ===" && cat /var/www/awesomeiwb/dist/manifest.webmanifest 2>/dev/null && echo "" && echo "=== Check SW cache strategy ===" && cat /var/www/awesomeiwb/dist/sw.js 2>/dev/null | head -50`;

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
