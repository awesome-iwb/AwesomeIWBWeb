const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
const cmd = process.argv.slice(2).join(' ') || 'uname -a';
const c = new Client();
c.on('ready', () => {
  c.exec(cmd, (e, s) => {
    if (e) { console.error(e); process.exit(1); }
    let out = '', err = '';
    s.on('data', d => { out += d; });
    s.stderr.on('data', d => { err += d; });
    s.on('close', code => {
      process.stdout.write(out);
      if (err) process.stderr.write('STDERR: ' + err);
      process.exit(code || 0);
    });
  });
}).on('error', e => { console.error('SSH:', e.message); process.exit(1); })
.connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 25000 });
