const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'cat /etc/awesomeiwb/backend.env',
  'grep -r "OAUTH" /opt/awesomeiwb/backend/src/ --include="*.ts" -l',
  'grep -r "OAUTH" /opt/awesomeiwb/backend/src/ --include="*.ts" -n | head -30',
  'grep -r "stcn\\|oauth\\|login\\|OAUTH" /opt/awesomeiwb/backend/src/ --include="*.ts" -n | head -40',
];

conn.on('ready', () => {
  console.log('=== SSH Connected ===\n');
  let cmdIndex = 0;

  function runNext() {
    if (cmdIndex >= commands.length) {
      console.log('\n=== All commands completed ===');
      conn.end();
      return;
    }

    const cmd = commands[cmdIndex];
    const label = `Command ${cmdIndex + 1}: ${cmd}`;
    console.log(`\n${'='.repeat(80)}`);
    console.log(label);
    console.log('='.repeat(80));

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.log(`ERROR: ${err.message}`);
        cmdIndex++;
        runNext();
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => {
        stdout += data.toString();
      });

      stream.on('stderr', (data) => {
        stderr += data.toString();
      });

      stream.on('close', (code, signal) => {
        if (stdout) console.log(stdout);
        if (stderr) console.log(`STDERR: ${stderr}`);
        console.log(`Exit code: ${code}`);
        cmdIndex++;
        runNext();
      });
    });
  }

  runNext();
});

conn.on('error', (err) => {
  console.error('SSH Connection Error:', err.message);
  process.exit(1);
});

conn.connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000,
});
