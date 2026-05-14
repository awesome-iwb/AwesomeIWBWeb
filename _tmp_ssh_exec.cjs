const { Client } = require('ssh2');
const fs = require('fs');
const argCommand = process.argv.slice(2).join(' ');
let command = argCommand;
if (!command && !process.stdin.isTTY) command = fs.readFileSync(0, 'utf8').trim();
if (!command) { console.error('Usage: node _tmp_ssh_exec.cjs <command>'); process.exit(1); }
const conn = new Client();
conn.on('ready', () => {
  conn.exec(command, (err, stream) => {
    if (err) { console.error('exec error:', err.message); conn.end(); process.exit(2); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => { conn.end(); process.exit(code ?? 0); });
  });
}).on('error', (err) => { console.error('SSH error:', err.message); process.exit(3); }).connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000,
});
