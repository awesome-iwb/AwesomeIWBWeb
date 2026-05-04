# Nginx 反代与 HTTPS（通用）

本项目推荐用 Nginx 作为统一入口：
- `/`：前端静态文件（`frontend/dist`）
- `/api/`：反代后端（默认 `127.0.0.1:8080`）

## 1. 基础 Nginx 配置（HTTP）

创建站点配置（Debian/Ubuntu 示例）：

`/etc/nginx/sites-available/awesome-iwb.conf`

```nginx
server {
  listen 80;
  server_name example.com;

  location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    root /opt/awesome-iwb/frontend/dist;
    try_files $uri $uri/ /index.html;
  }
}
```

启用并检查：

```bash
sudo ln -sf /etc/nginx/sites-available/awesome-iwb.conf /etc/nginx/sites-enabled/awesome-iwb.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 2. HTTPS（Let’s Encrypt / Certbot）

### 1) 安装 certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2) 申请证书并自动改配置

```bash
sudo certbot --nginx -d example.com
```

### 3) 自动续期验证

```bash
sudo certbot renew --dry-run
```

## 3. 常见面板的等价配置

如果你用面板（BT/1Panel/aaPanel），核心原则一样：

- 网站根目录指向 `frontend/dist`
- 反向代理新增规则：`/api` → `http://127.0.0.1:8080`
- HTTPS 交给面板自带的 Let’s Encrypt

具体点击路径见：
- `docs/deploy/10-宝塔面板-BT.md`
- `docs/deploy/11-1Panel.md`
- `docs/deploy/12-aaPanel.md`

