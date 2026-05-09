import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "===== 1. DNS Resolution ====="',
    'dig aiwb.smart-teach.cn +short 2>/dev/null || nslookup aiwb.smart-teach.cn 2>/dev/null | grep -A2 "Name:"',
    'echo ""',
    'echo "===== 2. Nginx Config (sites-available) ====="',
    'cat /etc/nginx/sites-available/awesomeiwb',
    'echo ""',
    'echo "===== 3. Nginx Sites Enabled ====="',
    'ls -la /etc/nginx/sites-enabled/',
    'echo ""',
    'echo "===== 4. Port 80 Usage ====="',
    'ss -tlnp | grep \':80 \'',
    'echo ""',
    'echo "===== 5. Backend CORS Env ====="',
    'cat /etc/awesomeiwb/backend.env',
    'echo ""',
    'echo "===== 6. Nginx IP Config Template ====="',
    'cat /opt/awesomeiwb/deploy/nginx/awesomeiwb-ip.conf',
    'echo ""',
    'echo "===== 7. Nginx HTTPS Config Template ====="',
    'cat /opt/awesomeiwb/deploy/nginx/awesomeiwb-https.conf',
    'echo ""',
    'echo "===== 8. Docker Container Ports ====="',
    'docker ps --format "table {{.Names}}\\t{{.Ports}}"',
    'echo ""',
    'echo "===== 9. UFW Port 80 Status ====="',
    'ufw status | grep 80',
  ];

  const cmd = commands.join(' && ') + ' 2>&1';

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
