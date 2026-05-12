const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  // 停止容器自动重启
  "docker update --restart=no 1Panel-openresty-zpMY",
  "docker stop 1Panel-openresty-zpMY",
  // 删除错误的配置文件
  "rm -f /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/api.conf",
  "rm -f /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf",
  // 使用 printf 创建正确的配置文件（真正的换行符）
  "printf 'location ^~ /api/ {\\n    proxy_pass http://127.0.0.1:8081;\\n    proxy_http_version 1.1;\\n    proxy_set_header Host $host;\\n    proxy_set_header X-Real-IP $remote_addr;\\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\\n    proxy_set_header X-Forwarded-Proto $scheme;\\n    client_max_body_size 10m;\\n}\\n' > /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/api.conf",
  "printf 'location / {\\n    root /var/www/awesomeiwb/dist;\\n    index index.html;\\n    try_files $uri $uri/ $uri.html /index.html;\\n}\\n\\nlocation ~* \\.(js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$ {\\n    root /var/www/awesomeiwb/dist;\\n    expires 7d;\\n    add_header Cache-Control \"public, immutable\";\\n}\\n' > /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf",
  // 验证文件内容
  "cat /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/api.conf",
  "cat /opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/static.conf",
  // 启动容器
  "docker start 1Panel-openresty-zpMY",
  "sleep 3",
  // 检查容器状态
  "docker ps | grep openresty",
  // 测试
  "curl -s http://127.0.0.1:80/api/health",
  "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:80/",
];

let i = 0;
function runNext() {
  if (i >= commands.length) { conn.end(); return; }
  console.log(`\n[${i + 1}/${commands.length}] ${commands[i].substring(0, 60)}`);
  conn.exec(commands[i], (err, stream) => {
    if (err) { console.error(err); i++; runNext(); return; }
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", () => { i++; runNext(); });
  });
}

conn.on("ready", runNext).on("error", (err) => console.error("Error:", err));
conn.connect({ host: "210.16.165.251", port: 22, username: "root", password: "8EGZ4jf3vumREH", readyTimeout: 60000 });
