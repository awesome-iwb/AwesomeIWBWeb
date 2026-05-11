# 修复生产环境部署问题 Spec

## Why
生产环境网站完全无法访问，后端 API 全部失效，用户无法登录，后台管理功能无法使用。经诊断发现多个关键配置错误和架构问题需要一并修复。

## What Changes
- **修复 nginx 与后端端口不匹配**：统一使用 8080 端口
- **修复 AdminView 认证方式**：从 API Token 改为基于 useAuth 的 Session Cookie 认证
- **修复后端 checkCap 超级管理员判断逻辑**：确保超级管理员正确识别
- **修复前端路由守卫和权限检查**：确保登录状态正确同步
- **修复后端环境变量配置**：确保生产环境正确加载 DATABASE_URL
- **添加后端健康检查端点**：便于监控和诊断

## Impact
- 受影响系统：nginx 配置、后端服务、前端 AdminView、认证流程
- 受影响文件：
  - `deploy/nginx/awesomeiwb-ip.conf`
  - `deploy/nginx/awesomeiwb-https.conf`
  - `deploy/systemd/awesomeiwb-backend.service`
  - `backend/src/index.ts`
  - `backend/src/services/capabilities.ts`
  - `backend/src/plugins/auth.ts`
  - `frontend/src/views/AdminView.vue`
  - `frontend/src/router/index.ts`

## ADDED Requirements

### Requirement: 后端健康检查端点
The system SHALL 提供 `/api/health` 端点返回服务状态和数据库连接状态。

#### Scenario: 健康检查成功
- **WHEN** 访问 `/api/health`
- **THEN** 返回 `{ status: "ok", db: true/false, timestamp: ... }`

### Requirement: 后端监听端口统一为 8080
The system SHALL 默认监听 8080 端口，与 nginx 代理配置一致。

#### Scenario: 服务启动
- **WHEN** 后端启动且未设置 PORT 环境变量
- **THEN** 监听 8080 端口（而非 8081）

## MODIFIED Requirements

### Requirement: AdminView 认证方式
The system SHALL 使用基于 Session Cookie 的认证，而非 API Token。

#### Scenario: 已登录用户访问后台
- **GIVEN** 用户已通过 OAuth 或密码登录（cookie 中有 session）
- **WHEN** 用户访问 /admin 页面
- **THEN** 自动识别登录状态，无需输入 API Token
- **AND** 所有 admin API 请求携带 credentials: 'include'
- **AND** 不发送 Authorization: Bearer 头

#### Scenario: 未登录用户访问后台
- **GIVEN** 用户未登录
- **WHEN** 用户访问 /admin 页面
- **THEN** 重定向到登录页面或显示登录按钮

### Requirement: 后端超级管理员判断
The system SHALL 正确识别超级管理员，不受大小写和空格影响。

#### Scenario: 超级管理员访问受保护资源
- **GIVEN** 用户名为超级管理员初始用户名（默认 "lincube"）
- **WHEN** 访问需要权限的 API
- **THEN** 跳过权限检查，直接允许访问

### Requirement: 前端权限同步
The system SHALL 在页面加载时同步用户权限状态。

#### Scenario: 刷新页面后保持权限
- **GIVEN** 用户已登录且有后台访问权限
- **WHEN** 刷新 /admin 页面
- **THEN** 保持登录状态，正确显示管理界面

## REMOVED Requirements

### Requirement: AdminView API Token 认证
**Reason**: API Token 认证与后端 Session Cookie 认证不兼容，导致所有 API 请求 401/403
**Migration**: 改为使用 useAuth 的 isAuthenticated 和 hasCapability
