const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';
const LOCAL_DIST = 'd:\\github\\AwesomeIWBWeb\\frontend\\dist';
const CORRECT_DIST = '/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist';

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

function put(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(localPath);
    const ws = sftp.createWriteStream(remotePath);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('close', resolve);
    rs.pipe(ws);
  });
}

function walkDir(dir, base) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, base));
    } else {
      results.push({ local: fullPath, remote: relPath });
    }
  }
  return results;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST, port: 22, username: USER, password: PASS,
      readyTimeout: 60000, keepaliveInterval: 10000,
    });
  });
  console.log('Connected!');

  try {
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
    });

    // Clear old dist
    console.log('Clearing old dist...');
    await exec(conn, `rm -rf ${CORRECT_DIST}/*`);

    // Collect all files
    const files = walkDir(LOCAL_DIST, LOCAL_DIST);
    console.log(`Found ${files.length} files to upload`);

    // Collect directories to create
    const dirs = new Set();
    for (const file of files) {
      const dir = file.remote.substring(0, file.remote.lastIndexOf('/'));
      if (dir) dirs.add(dir);
    }

    // Create all directories first
    console.log('Creating directories...');
    for (const dir of dirs) {
      await exec(conn, `mkdir -p ${CORRECT_DIST}/${dir}`);
    }

    // Upload all files
    console.log('Uploading files...');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const remotePath = `${CORRECT_DIST}/${file.remote}`;
      await put(sftp, file.local, remotePath);
      if ((i + 1) % 50 === 0 || i === files.length - 1) {
        process.stdout.write(`  Uploaded ${i + 1}/${files.length}\n`);
      }
    }

    // Verify inside container
    console.log('\nVerifying inside container...');
    const routesCheck = await exec(conn, 'docker exec 1Panel-openresty-zpMY ls /www/sites/aiwb.smart-teach.cn/dist/admin/routes.html 2>&1');
    console.log('routes.html:', routesCheck.stdout.trim());

    const adminFetchCheck = await exec(conn, `docker exec 1Panel-openresty-zpMY sh -c "grep -c 'adminFetch' /www/sites/aiwb.smart-teach.cn/dist/assets/RoutesView*.js 2>&1"`);
    console.log('RoutesView adminFetch count:', adminFetchCheck.stdout.trim());

    // Reload OpenResty
    await exec(conn, 'docker exec 1Panel-openresty-zpMY nginx -s reload 2>&1');
    console.log('OpenResty reloaded');

    // Also sync to other paths
    await exec(conn, 'rm -rf /var/www/awesomeiwb/dist/*');
    await exec(conn, `cp -a ${CORRECT_DIST}/* /var/www/awesomeiwb/dist/`);

    // Test
    const testRoutes = await exec(conn, 'curl -sI https://aiwb.smart-teach.cn/admin/routes 2>&1 | head -3');
    console.log('/admin/routes:', testRoutes.stdout.trim());

    console.log('\nDEPLOY_COMPLETE');
  } finally {
    conn.end();
  }
}

main().catch(console.error);
