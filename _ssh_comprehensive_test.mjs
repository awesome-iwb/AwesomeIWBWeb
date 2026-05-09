import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'echo "========================================"',
    'echo "  项目详情页综合测试"',
    'echo "========================================"',
    'echo ""',

    'echo "=== 测试 1: 完整页面加载流程 (预渲染 HTML + JS bundle) ==="',
    'curl -s http://127.0.0.1:8080/project/ICC-CE | grep -E "(animate-pulse|app-hunK0zu|registerSW|ICC-CE)"',
    'echo ""',

    'echo "=== 测试 2: 预渲染项目详情 HTML 内容 ==="',
    'cat /var/www/awesomeiwb/dist/project/ICC-CE.html | grep -E "(animate-pulse|ICC-CE|CJKmkp)" | head -10',
    'echo ""',

    'echo "=== 测试 3: 项目详情 API 响应 ==="',
    'curl -s http://127.0.0.1:8080/api/projects/ICC-CE | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({k:d.get(k) for k in [\'name\',\'developer\',\'status\',\'description\',\'keywords\']}, ensure_ascii=False, indent=2))"',
    'echo ""',

    'echo "=== 测试 4: 首页项目列表 ==="',
    'curl -s http://127.0.0.1:8080/api/projects | python3 -c "import sys,json; d=json.load(sys.stdin); cats=d.get(\'categories\',[]); print(f\'Categories: {len(cats)}\'); total=sum(len(c.get(\'projects\',[])) for c in cats); print(f\'Total projects: {total}\'); [print(f\'  {c[\"name\"]}: {len(c.get(\"projects\",[]))} projects\') for c in cats[:3]]"',
    'echo ""',

    'echo "=== 测试 5: Story 封面图片响应头 ==="',
    'curl -sI http://127.0.0.1:8080/api/stories/feature-classisland/cover.webp | head -10',
    'echo ""',

    'echo "=== 测试 6: Today 页面预渲染 HTML ==="',
    'curl -s http://127.0.0.1:8080/today | grep -o \'<title>[^<]*</title>\'',
    'echo ""',

    'echo "=== 测试 7: SW 注册脚本 ==="',
    'curl -s http://127.0.0.1:8080/registerSW.js',
    'echo ""',

    'echo "=== 测试 8: JS Bundle Content-Type ==="',
    'curl -sI http://127.0.0.1:8080/assets/app-hunK0zu-.js | head -5',
    'echo ""',

    'echo "=== 测试 9: Nginx 访问日志 ==="',
    'tail -20 /var/log/nginx/access.log',
    'echo ""',

    'echo "=== 测试 10: Nginx 错误日志 ==="',
    'tail -10 /var/log/nginx/error.log',
    'echo ""',

    'echo "========================================"',
    'echo "  测试完成"',
    'echo "========================================"',
  ];

  const cmd = commands.join('\n');

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
