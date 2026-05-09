import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const conn = new Client();

conn.on('ready', () => {
  const indexTs = readFileSync('d:/github/AwesomeIWBWeb/backend/src/index.ts', 'utf8');
  const projectTagsTs = readFileSync('d:/github/AwesomeIWBWeb/backend/src/domain/projectTags.ts', 'utf8');

  const indexB64 = Buffer.from(indexTs).toString('base64');
  const tagsB64 = Buffer.from(projectTagsTs).toString('base64');

  const commands = [
    `echo "${indexB64}" | base64 -d > /opt/awesomeiwb/backend/src/index.ts`,
    `echo "${tagsB64}" | base64 -d > /opt/awesomeiwb/backend/src/domain/projectTags.ts`,
    'echo "=== Verify storyFileAllowlist fix ==="',
    'grep -n "storyImageExtensions" /opt/awesomeiwb/backend/src/index.ts',
    'echo "=== Verify normalizeProjectTags fix ==="',
    'grep -n "merged.length" /opt/awesomeiwb/backend/src/domain/projectTags.ts',
    'echo "=== Restarting backend ==="',
    'systemctl restart awesomeiwb-backend',
    'sleep 3',
    'systemctl status awesomeiwb-backend --no-pager -l | head -10',
  ];

  const cmd = commands.join(' && ') + ' 2>&1';

  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('EXEC ERROR:', err); conn.end(); process.exit(1); }
    let stdout = '', stderr = '';
    stream.on('data', (data) => { stdout += data; });
    stream.stderr.on('data', (data) => { stderr += data; });
    stream.on('close', () => {
      if (stdout) console.log(stdout);
      if (stderr) console.error('STDERR:', stderr);
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('CONN ERROR:', err.message);
  process.exit(1);
}).connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000
});
