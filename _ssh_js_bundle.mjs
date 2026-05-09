import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check JS bundle for fetchProjects logic ===" && grep -o "fetchProjects[^}]*}" /var/www/awesomeiwb/dist/assets/app-BMVCVE0P.js | head -3 && echo "" && echo "=== Check for any error handling in the bundle ===" && grep -c "catch" /var/www/awesomeiwb/dist/assets/app-BMVCVE0P.js && echo "" && echo "=== Check if there are console.error statements ===" && grep -o "console.error[^)]*)" /var/www/awesomeiwb/dist/assets/app-BMVCVE0P.js | head -5 && echo "" && echo "=== Check the homepage HTML for loading state ===" && grep -o "animate-pulse\\|loading\\|0 款" /var/www/awesomeiwb/dist/index.html | head -10`;

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
