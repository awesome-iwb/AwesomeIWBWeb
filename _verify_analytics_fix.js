const { Client } = require('ssh2');
const pass = process.env.SSH_PASS;
const cmd = [
  'docker exec awesomeiwb-backend bun -e "',
  "import { getAnalyticsOverview } from './src/services/analytics.ts';",
  'const r = await getAnalyticsOverview(7);',
  "console.log(JSON.stringify({ ok: true, pv: r.pv, pages: r.topPages.length }));",
  '"',
].join(' ');

const c = new Client();
c.on('ready', () => {
  c.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => process.exit(code || 0));
  });
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: pass, readyTimeout: 30000 });
