import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== External API test ===" && curl -s "http://210.16.165.251:8080/api/projects/ICC-CE" | head -c 500 && echo "" && echo "=== External stories test ===" && curl -s "http://210.16.165.251:8080/api/stories" | head -c 300 && echo "" && echo "=== Test story cover via nginx ===" && curl -sI "http://210.16.165.251:8080/api/stories/feature-classisland/cover.webp" | head -5 && echo "" && echo "=== Check backend journal for recent errors ===" && journalctl -u awesomeiwb-backend --no-pager -n 10 --since "5 min ago"`;

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
