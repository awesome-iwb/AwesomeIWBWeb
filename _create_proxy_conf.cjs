const { Client } = require("ssh2");
const conn = new Client();

const commands = [
  "mkdir -p /www/sites/aiwb.smart-teach.cn/proxy",
  "echo 'location ^~ /api/ {\\n    proxy_pass http://127.0.0.1:8081;\\n    proxy_http_version 1.1;\\n    proxy_set_header Host $host;\\n    proxy_set_header X-Real-IP $remote_addr;\\n    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\\n    proxy_set_header X-Forwarded-Proto $scheme;\\n    client_max_body_size 10m;\\n}' > /www/sites/aiwb.smart-teach.cn/proxy/api.conf",
  "echo 'location = / {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files /index.html =404;\n}\n\nlocation = /index.html {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files $uri =404;\n}\n\nlocation = /me {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files /me.html /index.html =404;\n}\n\nlocation = /me.html {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files $uri /index.html =404;\n}\n\nlocation ~* ^/.*auth.*callback.*\\.html$ {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files $uri /index.html =404;\n}\n\nlocation = /registerSW.js {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files $uri =404;\n}\n\nlocation = /manifest.webmanifest {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files $uri =404;\n}\n\nlocation = /sw.js {\n    root /var/www/awesomeiwb/dist;\n    add_header Cache-Control \"no-cache, no-store, must-revalidate\" always;\n    add_header Pragma \"no-cache\" always;\n    add_header Expires \"0\" always;\n    try_files $uri =404;\n}\n\nlocation / {\n    root /var/www/awesomeiwb/dist;\n    index index.html;\n    try_files $uri $uri/ /index.html;\n}\n\nlocation ^~ /assets/ {\n    root /var/www/awesomeiwb/dist;\n    expires 365d;\n    add_header Cache-Control \"public, max-age=31536000, immutable\" always;\n}\n\nlocation ~* \\.(js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$ {\n    root /var/www/awesomeiwb/dist;\n    expires 7d;\n    add_header Cache-Control \"public, max-age=604800\" always;\n}' > /www/sites/aiwb.smart-teach.cn/proxy/static.conf",
  "cat /www/sites/aiwb.smart-teach.cn/proxy/api.conf",
  "cat /www/sites/aiwb.smart-teach.cn/proxy/static.conf",
  "/usr/local/openresty/bin/openresty -t",
  "/usr/local/openresty/bin/openresty -s reload",
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
