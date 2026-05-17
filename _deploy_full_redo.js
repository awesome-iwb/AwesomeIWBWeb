const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const conn = new Client();

const backendFiles = [
  'backend/src/config.ts',
  'backend/src/services/storage.ts',
  'backend/src/services/media.ts',
  'backend/src/index.ts',
  'backend/src/domain/normalizeProjectInput.ts',
  'backend/src/domain/normalizeProjectInput.test.ts',
  'backend/src/scripts/backfill-media-references.ts',
];

const frontendFiles = [
  'frontend/src/App.vue',
  'frontend/src/components/NavBar.vue',
  'frontend/src/components/admin/FloatingPanel.vue',
  'frontend/src/composables/useAdminFetch.ts',
  'frontend/src/composables/useAuth.ts',
  'frontend/src/views/HomeView.vue',
  'frontend/src/views/SubmitProjectView.vue',
  'frontend/src/views/admin/ProjectsView.vue',
  'frontend/src/views/admin/UsersView.vue',
];

const allFiles = [...backendFiles, ...frontendFiles];

conn.on('ready', () => {
  console.log('SSH connected!');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    let idx = 0;
    function uploadNext() {
      if (idx >= allFiles.length) {
        console.log('\nAll files uploaded! Now building and deploying...');
        const commands = [
          `cd /opt/awesomeiwb/backend && bun build --no-bundle src/index.ts > /dev/null 2>&1 && echo "Backend build OK" || echo "Backend build FAILED"`,
          `cd /opt/awesomeiwb/frontend && VITE_SSG_API_BASE=https://aiwb.smart-teach.cn bun run build 2>&1 | tail -5`,
          `rm -rf /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/* && cp -r /opt/awesomeiwb/frontend/dist/* /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/dist/ && echo "Frontend deployed!"`,
          `fuser -k 8080/tcp 2>/dev/null; fuser -k 8081/tcp 2>/dev/null; sleep 2`,
          `systemctl restart awesomeiwb-backend && sleep 3 && systemctl is-active awesomeiwb-backend`,
          `echo -n "API /api/projects: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/api/projects`,
          `echo "" && echo -n "API /api/auth/login: " && curl -sk https://aiwb.smart-teach.cn/api/auth/login 2>&1 | head -c 200`,
          `echo "" && echo -n "Home: " && curl -sk -o /dev/null -w "%{http_code}" https://aiwb.smart-teach.cn/`,
        ];
        let cmdIdx = 0;
        function runNext() {
          if (cmdIdx >= commands.length) { console.log('\nAll done!'); conn.end(); return; }
          conn.exec(commands[cmdIdx], (err2, stream) => {
            if (err2) { console.error('Error:', err2.message); cmdIdx++; runNext(); return; }
            stream.on('data', (data) => process.stdout.write(data.toString()));
            stream.stderr.on('data', (data) => process.stdout.write('[STDERR] ' + data.toString()));
            stream.on('close', () => { cmdIdx++; runNext(); });
          });
        }
        runNext();
        return;
      }

      const f = allFiles[idx];
      const localPath = path.join('D:\\github\\AwesomeIWBWeb', f);
      const remotePath = `/opt/awesomeiwb/${f}`;
      console.log(`Uploading ${f}...`);
      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on('close', () => {
        console.log(`  ✓ ${f}`);
        idx++;
        uploadNext();
      });
      writeStream.on('error', (e) => { console.error(`  ✗ ${f}:`, e.message); conn.end(); });
      readStream.pipe(writeStream);
    }
    uploadNext();
  });
});

conn.on('error', (err) => console.error('SSH Error:', err.message));
conn.connect({ host: '210.16.165.251', port: 22, username: 'root', password: '8EGZ4jf3vumREH', readyTimeout: 15000 });
