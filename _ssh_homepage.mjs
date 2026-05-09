import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check homepage SSR content ===" && curl -s "http://210.16.165.251:8080/" | grep -o "款优质教育软件\\|animate-pulse\\|项目\\|project" | head -20 && echo "" && echo "=== Check if JS loads ===" && curl -sI "http://210.16.165.251:8080/assets/app-BMVCVE0P.js" | head -5 && echo "" && echo "=== Test API from external with correct origin ===" && curl -s -H "Origin: http://210.16.165.251:8080" -H "Content-Type: application/json" "http://210.16.165.251:8080/api/projects" | head -c 200`;

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
