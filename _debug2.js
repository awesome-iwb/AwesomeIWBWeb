const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec(`cd /opt/awesomeiwb/backend && cat backend.env | head -3 && echo "---" && DATABASE_URL="postgresql://awesomeiwb:cd316733db8145bc149e54cfdeb843cabb439219146f5a1f@localhost:5432/awesomeiwb" bun run src/index.ts 2>&1 | head -50`, (err, stream) => {
    if (err) { console.error('Error:', err.message); conn.end(); return; }
    stream.on('data', (data) => process.stdout.write(data.toString()));
    stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
    stream.on('close', () => { conn.end(); });
  });
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
