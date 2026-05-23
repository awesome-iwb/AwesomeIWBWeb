const { Client } = require('ssh2');
const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => (stdout += d.toString()));
      stream.stderr.on('data', (d) => (stderr += d.toString()));
      stream.on('close', (code) => resolve({ code, stdout, stderr }));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST, port: 22, username: USER, password: PASS,
      readyTimeout: 60000, keepaliveInterval: 10000,
    });
  });

  try {
    // Check RoutesView JS for useAdminFetch or Authorization header
    console.log('=== RoutesView JS content check ===');
    const check1 = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "grep -l 'useAdminFetch\\|Authorization\\|Bearer' /www/sites/aiwb.smart-teach.cn/dist/assets/RoutesView*.js 2>&1"`);
    console.log('RoutesView uses auth:', check1.stdout.trim());

    // Check if the RoutesView imports useAdminFetch
    const check2 = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "head -c 500 /www/sites/aiwb.smart-teach.cn/dist/assets/RoutesView*.js 2>&1"`);
    console.log('RoutesView JS head:', check2.stdout.substring(0, 300));

    // Check the useAdminFetch chunk
    const check3 = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "ls -la /www/sites/aiwb.smart-teach.cn/dist/assets/useAdminFetch*.js 2>&1"`);
    console.log('useAdminFetch chunk:', check3.stdout.trim());

    // Check the app bundle for route:manage and users secondary
    const check4 = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "grep -c 'route:manage' /www/sites/aiwb.smart-teach.cn/dist/assets/app-*.js 2>&1"`);
    console.log('app.js route:manage count:', check4.stdout.trim());

    const check5 = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "grep -c 'analytics:read' /www/sites/aiwb.smart-teach.cn/dist/assets/app-*.js 2>&1"`);
    console.log('app.js analytics:read count:', check5.stdout.trim());

    // Check the pages API with a real auth token
    console.log('\n=== Test pages API with auth ===');
    const check6 = await exec(conn, `curl -s http://127.0.0.1:8081/api/admin/pages 2>&1 | head -c 300`);
    console.log('Pages API (no auth):', check6.stdout.substring(0, 200));

    // Check the latest RoutesView file timestamp
    const check7 = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "ls -la /www/sites/aiwb.smart-teach.cn/dist/assets/RoutesView*.js 2>&1"`);
    console.log('RoutesView files:', check7.stdout.trim());

  } finally {
    conn.end();
  }
}

main().catch(console.error);
