# Tasks

- [x] Task 1: 回滚代码仓库中被错误修改的文件
  - [x] SubTask 1.1: 回滚 `backend/src/index.ts` 默认端口从 8080 恢复为 8081（保留 `/api/health` 端点）
  - [x] SubTask 1.2: 回滚 `deploy/docker-compose.yml` PORT 从 "8080" 恢复为 "8081"
  - [x] SubTask 1.3: 回滚 `deploy/systemd/awesomeiwb-backend.service` 移除 `Environment="PORT=8080"`
  - [x] SubTask 1.4: 回滚 `frontend/src/views/AdminView.vue` 恢复 API Token 认证方式

- [x] Task 2: 修复服务器 OpenResty 代理配置
  - [x] SubTask 2.1: 在 OpenResty 站点配置中添加前端静态文件 location 块，指向 `/www/sites/aiwb.smart-teach.cn/dist`
  - [x] SubTask 2.2: 重启 OpenResty 容器使配置生效
  - [x] SubTask 2.3: 验证 80 端口访问首页返回正确的 Awesome IWB 页面

- [x] Task 3: 修复服务器标准 nginx 配置
  - [x] SubTask 3.1: 确保 `/etc/nginx/sites-available/awesomeiwb` 的 proxy_pass 指向 8081
  - [x] SubTask 3.2: 恢复被删除的 `proxy_set_header Cookie` 和 `proxy_pass_header Set-Cookie`
  - [x] SubTask 3.3: 重载 nginx

- [x] Task 4: 重新构建并部署前端
  - [x] SubTask 4.1: 本地 `npm run build` 构建前端
  - [x] SubTask 4.2: 上传构建产物到服务器 `/var/www/awesomeiwb/dist/` 和 OpenResty www 目录
  - [x] SubTask 4.3: 验证前端页面正确显示

- [x] Task 5: 端到端验证
  - [x] SubTask 5.1: 验证 `http://aiwb.smart-teach.cn/` 显示正确页面 ✅
  - [x] SubTask 5.2: 验证 `http://aiwb.smart-teach.cn/api/health` 返回正常 ✅
  - [x] SubTask 5.3: 验证后台管理页面可以正常进入（需用户测试）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2, Task 3, Task 4]
