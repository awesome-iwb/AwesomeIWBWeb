# 修复生产环境反向代理和前端显示 Spec

## Why
之前的 AI 在修复部署问题时，错误地修改了服务器上的 OpenResty 代理配置，导致：
1. 通过 80 端口访问网站首页时显示 OpenResty 默认欢迎页而非我们的网站
2. OpenResty 代理配置缺少前端静态文件服务，只配置了 API 代理
3. 代码仓库中的 AdminView.vue 被错误改造，移除了 API Token 认证但 Session Cookie 认证不完整

## What Changes
- 修复 OpenResty 代理配置，添加前端静态文件服务
- 回滚 AdminView.vue 到之前的工作版本（使用 API Token 认证）
- 回滚后端默认端口为 8081（与服务器实际运行端口一致）
- 回滚 systemd 配置（移除 PORT=8080）
- 回滚 docker-compose.yml 端口为 8081
- 保留有价值的改动：`/api/health` 端点、`isSuperadmin` 大小写不敏感

## Impact
- 受影响系统：OpenResty 代理配置、后端服务、前端 AdminView
- 受影响文件：
  - 服务器：`/opt/1panel/apps/openresty/openresty/www/sites/aiwb.smart-teach.cn/proxy/` 下的配置
  - 服务器：`/etc/nginx/sites-available/awesomeiwb`
  - 代码：`backend/src/index.ts`
  - 代码：`frontend/src/views/AdminView.vue`
  - 代码：`deploy/docker-compose.yml`
  - 代码：`deploy/systemd/awesomeiwb-backend.service`

## ADDED Requirements

### Requirement: OpenResty 前端静态文件服务
The system SHALL 通过 OpenResty（80/443 端口）正确服务前端静态文件。

#### Scenario: 访问首页
- **WHEN** 用户通过 `http://aiwb.smart-teach.cn/` 访问网站
- **THEN** 返回 Awesome IWB 前端页面，而非 OpenResty 默认欢迎页

#### Scenario: 访问 API
- **WHEN** 用户访问 `/api/*` 路径
- **THEN** 请求被代理到后端 8081 端口

## MODIFIED Requirements

### Requirement: 后端默认监听端口
The system SHALL 默认监听 8081 端口，与服务器上 systemd 实际运行端口一致。

#### Scenario: 服务启动
- **WHEN** 后端启动且未设置 PORT 环境变量
- **THEN** 监听 8081 端口

### Requirement: AdminView 认证方式
The system SHALL 使用 API Token 认证方式进入后台管理页面。

#### Scenario: 管理员进入后台
- **WHEN** 管理员输入正确的 API Token
- **THEN** 进入后台管理页面

## REMOVED Requirements

### Requirement: 后端监听端口统一为 8080
**Reason**: 服务器上后端实际运行在 8081 端口，改为 8080 会导致端口不匹配
**Migration**: 保持 8081 端口，确保所有代理配置指向 8081

### Requirement: AdminView 使用 Session Cookie 认证
**Reason**: Session Cookie 认证改造不完整，导致后台管理页面无法正常使用
**Migration**: 恢复 API Token 认证方式
