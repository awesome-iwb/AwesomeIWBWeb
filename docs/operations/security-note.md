# 生产鉴权说明

## 现状

当前默认为 Casdoor/OAuth 主登录路径，密码登录仅保留给超管 `lincube` 应急使用。

## 风险边界

- 演示登录路径已移除
- 非 `lincube` 用户名密码登录被拒绝（需使用 OAuth）

## 使用建议

- 仅在可信维护环境中使用后台管理功能
- 不将当前鉴权方案作为长期终态
- 仅在紧急故障时使用超管密码登录
- 超管首次登录后必须改密

## 关联文件

- `frontend/src/views/AdminView.vue`
- `frontend/src/composables/useAuth.ts`
- `frontend/src/views/MeView.vue`
- `backend/src/plugins/localAuth.ts`

