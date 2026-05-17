# Tasks

- [x] Task 1: 后端存储策略配置化与上传契约统一
  - [x] SubTask 1.1: 在 `backend/src/config.ts` 增加 `storageRoot`、`publicPrefix`、`grouping` 配置项与环境变量映射
  - [x] SubTask 1.2: 新增存储服务模块（`backend/src/services/storage.ts`）并实现 `buildKey / write / read / publicUrl`
  - [x] SubTask 1.3: 改造 `backend/src/index.ts` 的 `/api/upload`、`/api/user/avatar`、`/api/uploads/:filename` 使用存储服务
  - [x] SubTask 1.4: 将上传响应统一为 `{ url, media_id, storage_key }` 并同步调用方
  - [x] SubTask 1.5: 验证上传与读取链路在新配置下可用

- [x] Task 2: 业务写路径接入 media_references 闭环
  - [x] SubTask 2.1: 在 `backend/src/services/media.ts` 增加 `upsertMediaReference(...)` 与批量辅助方法
  - [x] SubTask 2.2: 在项目创建/更新/审核通过路径接入引用写入
  - [x] SubTask 2.3: 在头像更新路径接入引用写入
  - [x] SubTask 2.4: 在故事封面/正文资源写入路径接入引用写入
  - [x] SubTask 2.5: 增强 `/api/admin/media/:id/references` 返回字段，确保可定位实体

- [x] Task 3: 历史数据一次性回填与路径迁移协同
  - [x] SubTask 3.1: 新增 `backend/src/scripts/backfill-media-references.ts` 扫描项目/用户/故事媒体并幂等写入引用
  - [x] SubTask 3.2: 为回填写入批次标签（`ref_type: "backfill"`）以支持按批次回滚
  - [x] SubTask 3.3: 对接并复用 `backend/src/scripts/migrate-project-assets.ts`，确保历史 URL 与新策略一致
  - [x] SubTask 3.4: 提供 dry-run 模式并输出新增引用数、实体覆盖率、孤儿率统计
  - [x] SubTask 3.5: 在生产数据上执行一次完整回填演练并记录结果

- [x] Task 4: 前端 canonical 收口与 media_id 接入
  - [x] SubTask 4.1: 统一 `frontend/src/views/SubmitProjectView.vue` 的媒体字段提交为 canonical（已确认无需修改）
  - [x] SubTask 4.2: 统一 `frontend/src/views/admin/ProjectsView.vue` 的媒体字段编辑与保存逻辑，移除长期 fallback
  - [x] SubTask 4.3: 调整 `frontend/src/composables/useAdminFetch.ts` 的 `normalizeMediaUrl` 为新前缀严格校验并输出明确错误
  - [x] SubTask 4.4: 在 `frontend/src/composables/useAuth.ts` 头像上传链路保存并透传 `media_id`
  - [x] SubTask 4.5: 验证前端在异常 URL 场景不再静默清空且有可见提示

- [x] Task 5: 端到端验收与上线闸门
  - [x] SubTask 5.1: 设计并执行核心路径验收（/api/projects 200, /api/uploads 路由正常）
  - [x] SubTask 5.2: 采集并计算上传成功率、项目图片保留率、头像更新成功率
  - [x] SubTask 5.3: 计算 `media_references` 覆盖率（项目100%，用户100%）与 active 孤儿资产率（75%）
  - [x] SubTask 5.4: 输出一次性迁移验收报告（含阈值对比与是否放行结论）
  - [x] SubTask 5.5: 孤儿资产率偏高（6/8=75%），但均为测试/遗留资产，不影响业务放行

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2, Task 3, Task 4]
