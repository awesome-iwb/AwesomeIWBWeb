# 同步与发布流程

## 同步流程（飞书 -> 网站数据）

1. 准备快照输入文件
2. 运行 `backend/src/scripts/sync-feishu-base.ts`
3. 检查 `backend/runtime/data.json` 与统计输出
4. 如需要构建生效，使用 `--write-seed` 回写 `backend/src/data.json`

## 发布前检查

- 前端可构建：`cd frontend && bun run build`
- 后端测试可通过：`cd backend && bun test`
- 关键页面检查：首页、详情、后台列表、提交审核

## 回滚与审计

- 项目变更可通过 revisions 回滚
- 管理动作可在审计日志中追踪

## 协作规范

- 同步脚本执行后必须记录来源和执行参数
- 影响 `backend/src/data.json` 的变更必须在 PR 描述中明确写出

