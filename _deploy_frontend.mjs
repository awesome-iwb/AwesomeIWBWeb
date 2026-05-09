import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const HOST = '210.16.165.251';
const USER = 'root';
const PASS = '8EGZ4jf3vumREH';
const LOCAL_DIST = path.resolve('d:\\github\\AwesomeIWBWeb\\frontend\\dist');
const REMOTE_DIST = '/var/www/awesomeiwb/dist';

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
      stream.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });
    });
  });
}

function uploadFileSFTP(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.on('close', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
    readStream.pipe(writeStream);
  });
}

function mkdirSFTP(sftp, dirPath) {
  return new Promise((resolve) => {
    sftp.mkdir(dirPath, (err) => {
      resolve(!err);
    });
  });
}

async function mkdirpSFTP(sftp, dirPath) {
  const parts = dirPath.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += '/' + part;
    await mkdirSFTP(sftp, current);
  }
}

async function uploadDirectory(sftp, localDir, remoteDir) {
  await mkdirpSFTP(sftp, remoteDir);
  
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  let fileCount = 0;
  
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = remoteDir + '/' + entry.name;
    
    if (entry.isDirectory()) {
      const count = await uploadDirectory(sftp, localPath, remotePath);
      fileCount += count;
    } else {
      await uploadFileSFTP(sftp, localPath, remotePath);
      fileCount++;
      if (fileCount % 50 === 0) {
        console.log(`  Uploaded ${fileCount} files...`);
      }
    }
  }
  
  return fileCount;
}

async function main() {
  const conn = new Client();
  
  conn.on('ready', async () => {
    console.log('SSH connection established');
    
    try {
      console.log('Backing up old dist...');
      await execCommand(conn, `cp -r ${REMOTE_DIST} ${REMOTE_DIST}.bak 2>/dev/null || true`);
      
      console.log('Clearing old dist...');
      await execCommand(conn, `rm -rf ${REMOTE_DIST}`);
      
      console.log('Uploading dist directory via SFTP...');
      const sftp = await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) reject(err);
          else resolve(sftp);
        });
      });
      
      const fileCount = await uploadDirectory(sftp, LOCAL_DIST, REMOTE_DIST);
      console.log(`Uploaded ${fileCount} files`);
      
      console.log('Setting permissions...');
      await execCommand(conn, `chown -R www-data:www-data ${REMOTE_DIST}`);
      
      console.log('Verifying deployment...');
      const { stdout: lsResult } = await execCommand(conn, `ls -la ${REMOTE_DIST}/ | head -15`);
      console.log(lsResult);
      
      const { stdout: assetCheck } = await execCommand(conn, `ls ${REMOTE_DIST}/assets/ | wc -l`);
      console.log(`Asset files count: ${assetCheck.trim()}`);
      
      const { stdout: swCheck } = await execCommand(conn, `head -3 ${REMOTE_DIST}/sw.js`);
      console.log(`SW file: ${swCheck.trim()}`);
      
      console.log('Reloading nginx...');
      await execCommand(conn, 'nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true');
      
      console.log('Testing...');
      const { stdout: apiTest } = await execCommand(conn, 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/projects/ICC-CE');
      console.log(`API test: ${apiTest.trim()}`);
      
      const { stdout: pageTest } = await execCommand(conn, 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/project/ICC-CE');
      console.log(`Page test: ${pageTest.trim()}`);
      
      const { stdout: jsTest } = await execCommand(conn, `ls ${REMOTE_DIST}/assets/*.js`);
      console.log(`JS files: ${jsTest.trim()}`);
      
      console.log('\n✅ Deployment complete!');
    } catch (e) {
      console.error('Deployment failed:', e);
      console.log('Rolling back...');
      await execCommand(conn, `rm -rf ${REMOTE_DIST} && mv ${REMOTE_DIST}.bak ${REMOTE_DIST} 2>/dev/null || true`);
    }
    
    conn.end();
  });
  
  conn.on('error', (err) => {
    console.error('SSH connection error:', err);
  });
  
  conn.connect({
    host: HOST,
    port: 22,
    username: USER,
    password: PASS,
    readyTimeout: 60000,
    keepaliveInterval: 10000
  });
}

main();
