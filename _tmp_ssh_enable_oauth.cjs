const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  {
    label: 'Step 1.1: Update OAUTH_ENABLED from false to true',
    cmd: "sed -i 's|^OAUTH_ENABLED=.*|OAUTH_ENABLED=true|' /etc/awesomeiwb/backend.env",
  },
  {
    label: 'Step 1.2: Append Casdoor configuration variables',
    cmd: `cat >> /etc/awesomeiwb/backend.env << 'ENVEOF'
CASDOOR_ENDPOINT=https://auth.smart-teach.cn
CASDOOR_CLIENT_ID=fc578a97c73bf59db336
CASDOOR_CLIENT_SECRET=ce274c138e6a6b4c541f7b21ef0f566957db0285
CASDOOR_ORGANIZATION_NAME=stcn
CASDOOR_APPLICATION_NAME=awesome-iwb
CASDOOR_REDIRECT_URI=http://aiwb.smart-teach.cn/api/auth/callback
FRONTEND_URL=http://aiwb.smart-teach.cn
ENVEOF`,
  },
  {
    label: 'Step 1.3: Verify the backend.env file',
    cmd: 'cat /etc/awesomeiwb/backend.env',
  },
  {
    label: 'Step 2.1: Rebuild and restart the backend container',
    cmd: 'cd /opt/awesomeiwb/deploy && docker compose up -d backend --force-recreate',
  },
  {
    label: 'Step 2.2: Wait for backend to start and check container status',
    cmd: 'sleep 10 && docker ps --filter name=awesomeiwb-backend --format "{{.Names}} {{.Status}}"',
  },
  {
    label: 'Step 2.3: Check backend logs for errors',
    cmd: 'docker logs awesomeiwb-backend --tail 20',
  },
  {
    label: 'Step 3.1: Test the login endpoint directly',
    cmd: 'curl -s -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8081/api/auth/login | head -c 500',
  },
  {
    label: 'Step 3.2: Test the me endpoint (expect 401)',
    cmd: 'curl -s -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8081/api/auth/me',
  },
  {
    label: 'Step 3.3: Test login endpoint through nginx',
    cmd: 'curl -s -H "Host: aiwb.smart-teach.cn" http://127.0.0.1:8080/api/auth/login | head -c 500',
  },
  {
    label: 'Step 3.4: Check backend health',
    cmd: "docker inspect awesomeiwb-backend --format='{{.State.Health.Status}}'",
  },
];

conn.on('ready', () => {
  console.log('=== SSH Connected ===\n');
  let cmdIndex = 0;

  function runNext() {
    if (cmdIndex >= commands.length) {
      console.log('\n=== All commands completed ===');
      conn.end();
      return;
    }

    const { label, cmd } = commands[cmdIndex];
    console.log(`\n${'='.repeat(80)}`);
    console.log(label);
    console.log('='.repeat(80));

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.log(`ERROR: ${err.message}`);
        cmdIndex++;
        runNext();
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (data) => {
        stdout += data.toString();
      });

      stream.on('stderr', (data) => {
        stderr += data.toString();
      });

      stream.on('close', (code, signal) => {
        if (stdout) console.log(stdout);
        if (stderr) console.log(`STDERR: ${stderr}`);
        console.log(`Exit code: ${code}`);
        cmdIndex++;
        runNext();
      });
    });
  }

  runNext();
});

conn.on('error', (err) => {
  console.error('SSH Connection Error:', err.message);
  process.exit(1);
});

conn.connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000,
});
