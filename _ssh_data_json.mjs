import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const cmd = `echo "=== Check data.json ===" && python3 -c "import json; d=json.load(open('/opt/awesomeiwb/backend/src/data.json')); print(f'Categories: {len(d.get(\"categories\",[]))}'); [print(f'  {c[\"name\"]}: {len(c.get(\"projects\",[]))} projects') for c in d.get('categories',[])]" 2>&1 && echo "" && echo "=== Check index.html for project detail route ===" && grep -o "project" /var/www/awesomeiwb/dist/index.html | wc -l && echo "" && echo "=== Check if there are project-specific HTML files in subdirs ===" && find /var/www/awesomeiwb/dist -path "*/project/*" -name "*.html" 2>/dev/null | head -10 && echo "" && echo "=== Check dist directory structure ===" && find /var/www/awesomeiwb/dist -maxdepth 2 -type d | head -20`;

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
