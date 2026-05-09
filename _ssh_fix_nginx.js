const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  { label: '1. 读取当前nginx配置', cmd: 'cat /etc/nginx/sites-available/awesomeiwb' },
  { label: '2. 更新nginx配置 - 添加$uri.html到try_files', cmd: `sed -i 's|try_files $uri $uri/ /index.html;|try_files $uri $uri/ $uri.html /index.html;|' /etc/nginx/sites-available/awesomeiwb` },
  { label: '3. 验证修改后的nginx配置', cmd: 'cat /etc/nginx/sites-available/awesomeiwb' },
  { label: '4. 检查预渲染HTML文件', cmd: 'ls /var/www/awesomeiwb/dist/project/ | head -10' },
  { label: '5. 测试ICC-CE页面(修改前先不重载)', cmd: 'curl -s http://127.0.0.1:8080/project/ICC-CE | grep -o \'<title>[^<]*</title>\'' },
  { label: '6. 测试nginx配置并重载', cmd: 'nginx -t && nginx -s reload' },
  { label: '7. 重载后测试ICC-CE页面', cmd: 'sleep 1 && curl -s http://127.0.0.1:8080/project/ICC-CE | grep -o \'<title>[^<]*</title>\'' },
  { label: '8. 测试Ink Canvas页面', cmd: 'curl -s http://127.0.0.1:8080/project/Ink%20Canvas | grep -o \'<title>[^<]*</title>\'' },
  { label: '9. 测试首页', cmd: 'curl -s http://127.0.0.1:8080/ | grep -o \'<title>[^<]*</title>\'' },
  { label: '10. 测试today页面', cmd: 'curl -s http://127.0.0.1:8080/today | grep -o \'<title>[^<]*</title>\'' },
];

let index = 0;

function runNext() {
  if (index >= commands.length) {
    console.log('\n========== 所有任务完成 ==========');
    conn.end();
    return;
  }

  const { label, cmd } = commands[index++];
  console.log(`\n========== ${label} ==========`);
  console.log(`执行: ${cmd}\n`);

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.log(`错误: ${err.message}`);
      runNext();
      return;
    }

    let stdout = '';
    let stderr = '';

    stream.on('data', (data) => {
      stdout += data.toString();
    });

    stream.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    stream.on('close', (code) => {
      if (stdout) console.log(`输出:\n${stdout}`);
      if (stderr) console.log(`错误输出:\n${stderr}`);
      console.log(`退出码: ${code}`);
      runNext();
    });
  });
}

conn.on('ready', () => {
  console.log('SSH连接成功！');
  runNext();
});

conn.on('error', (err) => {
  console.log(`SSH连接错误: ${err.message}`);
});

conn.connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000,
});
