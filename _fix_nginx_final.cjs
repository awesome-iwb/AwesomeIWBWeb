const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  // 修复 nginx 配置：将代理指向 8081（后端实际端口）
  "sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:8081;|g' /etc/nginx/sites-available/awesomeiwb",
  // 移除可能导致循环的 cookie 代理设置
  "sed -i '/proxy_set_header Cookie/d' /etc/nginx/sites-available/awesomeiwb",
  "sed -i '/proxy_pass_header Set-Cookie/d' /etc/nginx/sites-available/awesomeiwb",
  // 验证配置
  "cat /etc/nginx/sites-available/awesomeiwb",
  // 测试 nginx 配置
  "nginx -t",
  // 重载 nginx
  "systemctl reload nginx",
  // 测试 API
  "curl -s http://127.0.0.1:8080/api/health",
  // 测试通过 nginx
  "curl -s -H 'Host: aiwb.smart-teach.cn' http://127.0.0.1:8080/api/health",
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
