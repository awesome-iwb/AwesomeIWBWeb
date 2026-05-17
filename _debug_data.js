const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const commands = [
    `echo "=== media_assets URLs ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT url FROM media_assets LIMIT 20;" 2>&1`,
    `echo "=== 项目 icon/banner 样本 ===" && PGPASSWORD=cd316733db8145bc149e54cfdeb843cabb439219146f5a1f psql -h localhost -U awesomeiwb -d awesomeiwb -t -c "SELECT name, icon, banner FROM projects WHERE icon IS NOT NULL OR banner IS NOT NULL LIMIT 10;" 2>&1`,
  ];
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { console.log('\nDone!'); conn.end(); return; }
    conn.exec(commands[idx], (err, stream) => {
      if (err) { console.error('Error:', err.message); idx++; runNext(); return; }
      stream.on('data', (data) => process.stdout.write(data.toString()));
      stream.stderr.on('data', (data) => process.stdout.write(''));
      stream.on('close', () => { idx++; runNext(); });
    });
  }
  runNext();
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
