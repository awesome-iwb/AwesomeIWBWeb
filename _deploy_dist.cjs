const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");
const conn = new Client();

const HOST = "210.16.165.251";
const USER = "root";
const PASS = "8EGZ4jf3vumREH";
const LOCAL_DIST = "d:\\github\\AwesomeIWBWeb\\frontend\\dist";
const REMOTE_DIST = "/var/www/awesomeiwb/dist";

conn.on("ready", async () => {
  console.log("Connected! Uploading dist files via SFTP...");

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  function mkdirp(remotePath) {
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (!err || err.code === 4) { resolve(); return; }
        const parent = remotePath.substring(0, remotePath.lastIndexOf("/"));
        if (!parent) { resolve(); return; }
        mkdirp(parent).then(() => {
          sftp.mkdir(remotePath, (err2) => {
            if (!err2 || err2.code === 4) resolve();
            else reject(err2);
          });
        }).catch(reject);
      });
    });
  }

  function uploadFile(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      const rs = fs.createReadStream(localPath);
      const ws = sftp.createWriteStream(remotePath);
      ws.on("close", resolve);
      ws.on("error", reject);
      rs.on("error", reject);
      rs.pipe(ws);
    });
  }

  async function walkAndUpload(localDir, remoteDir) {
    await mkdirp(remoteDir);
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const localPath = path.join(localDir, entry.name);
      const remotePath = remoteDir + "/" + entry.name;
      if (entry.isDirectory()) {
        await walkAndUpload(localPath, remotePath);
      } else {
        await uploadFile(localPath, remotePath);
      }
    }
  }

  console.log("Clearing remote dist...");
  await new Promise((resolve, reject) => {
    conn.exec(`rm -rf ${REMOTE_DIST}/*`, (err, stream) => {
      if (err) { reject(err); return; }
      stream.on("close", resolve);
      stream.stderr.on("data", () => {});
    });
  });

  console.log("Uploading files...");
  await walkAndUpload(LOCAL_DIST, REMOTE_DIST);

  console.log("\n=== Frontend deployment complete! ===");
  conn.end();
}).on("error", (err) => console.error("Error:", err));

conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000, keepaliveInterval: 10000 });
