const { Client } = require('ssh2');

const commands = [
  { label: '1. 项目详情页 HTML title', cmd: `curl -s http://127.0.0.1:8080/project/ICC-CE | grep -o '<title>[^<]*</title>'` },
  { label: '2. 项目详情页 JS bundle', cmd: `curl -s http://127.0.0.1:8080/project/ICC-CE | grep -o 'src="[^"]*\\.js"'` },
  { label: '3. 预渲染项目详情页', cmd: `cat /var/www/awesomeiwb/dist/project/ICC-CE.html | grep -o '<title>[^<]*</title>'` },
  { label: '4. 项目详情 API', cmd: `curl -s http://127.0.0.1:8080/api/projects/ICC-CE | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Name: {d[\\\"name\\\"]}, Developer: {d[\\\"developer\\\"]}, Status: {d[\\\"status\\\"]}')"` },
  { label: '5. Story 封面图片 HTTP 状态码', cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/stories/feature-classisland/cover.webp` },
  { label: '6. Stories API', cmd: `curl -s http://127.0.0.1:8080/api/stories | python3 -c "import sys,json; stories=json.load(sys.stdin); print(f'Stories count: {len(stories)}'); [print(f'  - {s[\\\"id\\\"]}: coverImage={s.get(\\\"coverImage\\\",\\\"N/A\\\")}') for s in stories[:3]]"` },
  { label: '7. 另一个项目详情页', cmd: `curl -s http://127.0.0.1:8080/project/Ink%20Canvas | grep -o '<title>[^<]*</title>'` },
  { label: '8. SW precache 项目页列表', cmd: `grep -o 'project/[^"]*\\.html' /var/www/awesomeiwb/dist/sw.js | head -10` },
  { label: '9. 外部访问项目详情页 HTTP 状态码', cmd: `curl -s -o /dev/null -w "%{http_code}" http://210.16.165.251:8080/project/ICC-CE` },
  { label: '10. 新 JS bundle 可访问性', cmd: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/assets/app-hunK0zu-.js` },
];

const conn = new Client();

conn.on('ready', () => {
  console.log('=== SSH 连接成功 ===\n');

  let index = 0;

  function runNext() {
    if (index >= commands.length) {
      console.log('\n=== 所有验证命令执行完毕 ===');
      conn.end();
      return;
    }

    const { label, cmd } = commands[index];
    index++;

    console.log(`--- ${label} ---`);
    console.log(`命令: ${cmd}`);

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.log(`错误: ${err.message}\n`);
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

      stream.on('close', (code, signal) => {
        if (stdout.trim()) console.log(`输出: ${stdout.trim()}`);
        if (stderr.trim()) console.log(`错误输出: ${stderr.trim()}`);
        if (code !== 0 && code !== null) console.log(`退出码: ${code}`);
        console.log('');
        runNext();
      });
    });
  }

  runNext();
});

conn.on('error', (err) => {
  console.error('SSH 连接错误:', err.message);
  process.exit(1);
});

conn.connect({
  host: '210.16.165.251',
  port: 22,
  username: 'root',
  password: '8EGZ4jf3vumREH',
  readyTimeout: 30000,
});
