import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== data.json structure ===" && python3 -c "import json; d=json.load(open('/opt/awesomeiwb/backend/src/data.json')); print(type(d)); print(list(d.keys()) if isinstance(d,dict) else len(d))" 2>&1 && echo "" && echo "=== Check project HTML files ===" && find /var/www/awesomeiwb/dist -path "*/project/*" -name "*.html" 2>/dev/null | head -10 && echo "=== Check dist subdirs ===" && find /var/www/awesomeiwb/dist -maxdepth 2 -type d | head -20`;

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
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000
});
