const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec(`bash -lc 'for p in /var/www/awesomeiwb/dist /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist; do echo PATH=$p; ls $p/assets/app-*.js; grep -o displayRole $p/assets/app-*.js | head -1; grep -o SiteReload $p/assets/app-*.js | head -1; grep -o canViewAnalytics $p/assets/app-*.js | head -1; done; cat /opt/awesomeiwb/backups/LATEST_ROLLBACK.txt'`, (e, s) => {
    s.on('data', d => process.stdout.write(d));
    s.on('close', () => c.end());
  });
}).connect({ host: '210.16.165.251', port: 22, username: 'root', password: process.env.DEPLOY_SSH_PASSWORD });
