const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";

const LOCAL_DIST = path.resolve("d:\\github\\AwesomeIWBWeb\\frontend\\dist");
const LOCAL_BACKEND_SRC = path.resolve("d:\\github\\AwesomeIWBWeb\\backend\\src");
const LOCAL_BACKEND_PKG = path.resolve("d:\\github\\AwesomeIWBWeb\\backend\\package.json");
const LOCAL_BACKEND_LOCK = path.resolve("d:\\github\\AwesomeIWBWeb\\backend\\bun.lock");
const LOCAL_BACKEND_STORIES = path.resolve("d:\\github\\AwesomeIWBWeb\\backend\\stories");
const LOCAL_BACKEND_MIGRATIONS = path.resolve("d:\\github\\AwesomeIWBWeb\\backend\\migrations");

const REMOTE_DIST = "/var/www/awesomeiwb/dist";
const REMOTE_BACKEND_SRC = "/opt/awesomeiwb/backend/src";
const REMOTE_BACKEND_PKG = "/opt/awesomeiwb/backend/package.json";
const REMOTE_BACKEND_LOCK = "/opt/awesomeiwb/backend/bun.lock";
const REMOTE_BACKEND_STORIES = "/opt/awesomeiwb/backend/stories";
const REMOTE_BACKEND_MIGRATIONS = "/opt/awesomeiwb/backend/migrations";

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (d) => { stdout += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d.toString()); });
      stream.on("close", (code) => resolve({ stdout, stderr, code }));
    });
  });
}

function getSFTP() {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(localPath);
    const ws = sftp.createWriteStream(remotePath);
    ws.on("close", resolve);
    ws.on("error", reject);
    rs.on("error", reject);
    rs.pipe(ws);
  });
}

function sftpMkdir(sftp, dirPath) {
  return new Promise((resolve) => {
    sftp.mkdir(dirPath, () => resolve());
  });
}

async function sftpMkdirp(sftp, dirPath) {
  const parts = dirPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += "/" + part;
    await sftpMkdir(sftp, current);
  }
}

async function uploadDir(sftp, localDir, remoteDir) {
  await sftpMkdirp(sftp, remoteDir);
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const lp = path.join(localDir, entry.name);
    const rp = remoteDir + "/" + entry.name;
    if (entry.isDirectory()) {
      count += await uploadDir(sftp, lp, rp);
    } else {
      await uploadFile(sftp, lp, rp);
      count++;
      if (count % 50 === 0) console.log(`  Uploaded ${count} files...`);
    }
  }
  return count;
}

async function main() {
  console.log("=== Connecting to server ===");
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve);
    conn.on("error", reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
  });
  console.log("Connected!\n");

  // ────────────────────────────────────────────────────────────────
  // STEP 1: Upload frontend dist via SFTP
  // ────────────────────────────────────────────────────────────────
  console.log("========================================");
  console.log("=== STEP 1: Upload frontend dist ===");
  console.log("========================================");

  console.log("\n[1.1] Clearing old dist...");
  const rmDist = await exec(`rm -rf ${REMOTE_DIST}/*`);
  console.log(rmDist.stdout + rmDist.stderr);

  console.log("\n[1.2] Uploading dist directory via SFTP...");
  const sftp = await getSFTP();
  const feCount = await uploadDir(sftp, LOCAL_DIST, REMOTE_DIST);
  console.log(`Uploaded ${feCount} frontend files`);

  console.log("\n[1.3] Setting permissions...");
  const chown = await exec(`chown -R www-data:www-data ${REMOTE_DIST}`);
  console.log(chown.stdout + chown.stderr);

  console.log("\n[1.4] Verifying frontend dist...");
  const lsDist = await exec(`ls -la ${REMOTE_DIST}/ | head -20`);
  console.log(lsDist.stdout);

  // ────────────────────────────────────────────────────────────────
  // STEP 2: Sync backend source code
  // ────────────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("=== STEP 2: Sync backend source code ===");
  console.log("========================================");

  console.log("\n[2.1] Clearing old backend src...");
  const rmSrc = await exec(`rm -rf ${REMOTE_BACKEND_SRC}/*`);
  console.log(rmSrc.stdout + rmSrc.stderr);

  console.log("\n[2.2] Uploading backend src directory via SFTP...");
  const beCount = await uploadDir(sftp, LOCAL_BACKEND_SRC, REMOTE_BACKEND_SRC);
  console.log(`Uploaded ${beCount} backend source files`);

  console.log("\n[2.3] Verifying backend src...");
  const lsSrc = await exec(`ls -la ${REMOTE_BACKEND_SRC}/`);
  console.log(lsSrc.stdout);

  console.log("\n[2.4] Uploading package.json...");
  if (fs.existsSync(LOCAL_BACKEND_PKG)) {
    await uploadFile(sftp, LOCAL_BACKEND_PKG, REMOTE_BACKEND_PKG);
    console.log("Uploaded package.json");
  } else {
    console.log("package.json not found, skipping");
  }

  console.log("\n[2.5] Uploading bun.lock...");
  if (fs.existsSync(LOCAL_BACKEND_LOCK)) {
    await uploadFile(sftp, LOCAL_BACKEND_LOCK, REMOTE_BACKEND_LOCK);
    console.log("Uploaded bun.lock");
  } else {
    console.log("bun.lock not found, skipping");
  }

  console.log("\n[2.6] Uploading stories directory...");
  if (fs.existsSync(LOCAL_BACKEND_STORIES)) {
    const rmStories = await exec(`rm -rf ${REMOTE_BACKEND_STORIES}/*`);
    console.log(rmStories.stdout + rmStories.stderr);
    const storiesCount = await uploadDir(sftp, LOCAL_BACKEND_STORIES, REMOTE_BACKEND_STORIES);
    console.log(`Uploaded ${storiesCount} stories files`);
  } else {
    console.log("stories directory not found, skipping");
  }

  console.log("\n[2.7] Uploading migrations directory...");
  if (fs.existsSync(LOCAL_BACKEND_MIGRATIONS)) {
    const rmMigrations = await exec(`rm -rf ${REMOTE_BACKEND_MIGRATIONS}/*`);
    console.log(rmMigrations.stdout + rmMigrations.stderr);
    const migrationsCount = await uploadDir(sftp, LOCAL_BACKEND_MIGRATIONS, REMOTE_BACKEND_MIGRATIONS);
    console.log(`Uploaded ${migrationsCount} migration files`);
  } else {
    console.log("migrations directory not found, skipping");
  }

  console.log("\n[2.8] Verifying all backend files...");
  const lsBackend = await exec(`ls -la /opt/awesomeiwb/backend/`);
  console.log(lsBackend.stdout);

  // ────────────────────────────────────────────────────────────────
  // STEP 3: Rebuild and restart the backend container
  // ────────────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("=== STEP 3: Rebuild and restart backend ===");
  console.log("========================================");

  console.log("\n[3.1] Building backend Docker image (no cache)...");
  const build = await exec("cd /opt/awesomeiwb/deploy && docker compose build backend --no-cache 2>&1");
  console.log(build.stdout + build.stderr);

  console.log("\n[3.2] Starting backend container...");
  const up = await exec("cd /opt/awesomeiwb/deploy && docker compose up -d backend 2>&1");
  console.log(up.stdout + up.stderr);

  console.log("\n[3.3] Waiting 10 seconds for backend to start...");
  await exec("sleep 10");

  console.log("\n[3.4] Checking container status...");
  const ps = await exec('docker ps --filter name=awesomeiwb-backend --format "{{.Names}} {{.Status}}"');
  console.log(ps.stdout);

  // ────────────────────────────────────────────────────────────────
  // STEP 4: Verify everything
  // ────────────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("=== STEP 4: Verify everything ===");
  console.log("========================================");

  console.log("\n[4.1] Test frontend...");
  const feTest = await exec('curl -s -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8080/');
  console.log(`Frontend HTTP status: ${feTest.stdout.trim()}`);

  console.log("\n[4.2] Test API...");
  const apiTest = await exec('curl -s -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8080/api/projects/ICC-CE');
  console.log(`API HTTP status: ${apiTest.stdout.trim()}`);

  console.log("\n[4.3] Test today page...");
  const todayTest = await exec('curl -s -o /dev/null -w "%{http_code}" -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8080/today');
  console.log(`Today page HTTP status: ${todayTest.stdout.trim()}`);

  console.log("\n[4.4] Check new JS bundle...");
  const jsBundle = await exec("ls -la /var/www/awesomeiwb/dist/assets/*.js");
  console.log(jsBundle.stdout);

  console.log("\n[4.5] Check backend health...");
  const health = await exec("docker inspect awesomeiwb-backend --format='{{.State.Health.Status}}' 2>/dev/null || echo 'not ready'");
  console.log(`Backend health: ${health.stdout.trim()}`);

  console.log("\n[4.6] Check backend logs...");
  const logs = await exec("docker logs awesomeiwb-backend --tail 5");
  console.log(logs.stdout);

  console.log("\n========================================");
  console.log("=== Deployment complete! ===");
  console.log("========================================");

  conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  conn.end();
  process.exit(1);
});
