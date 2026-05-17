# 伪图床一次性迁移执行计划（新版） Spec

## Why
当前媒体上传与读取链路存在硬编码目录、引用闭环不完整、前端字段形态不统一等问题，导致历史资源治理困难与线上可用性风险。需要以一次性迁移方式收口媒体治理，避免长期兼容分支带来的维护成本与数据漂移。

## What Changes
- 后端存储策略配置化：移除固定上传目录依赖，统一由存储服务负责 key 生成、写入、读取与公网 URL 生成。
- 统一上传返回契约为 `url`、`media_id`、`storage_key`，作为前后端唯一依赖。
- 打通 `media_assets` 与 `media_references` 写入闭环，覆盖项目、头像、故事三类业务写路径。
- 增强管理端媒体反查能力，返回可直接定位业务实体的引用字段集合。
- 新增一次性历史回填脚本，幂等补齐历史引用，并与历史资产路径迁移脚本协同执行。
- 前端统一 canonical 媒体字段并接入 `media_id`，移除长期 fallback 与静默清空行为。
- 建立硬指标验收与上线闸门，基于覆盖率、孤儿率与关键链路成功率放行。

## Impact
- Affected specs: 媒体上传与访问、媒体资产治理、管理端媒体审计、项目提交与审核、用户头像、故事资源管理。
- Affected code:
  - `backend/src/config.ts`
  - `backend/src/index.ts`
  - `backend/src/services/media.ts`
  - `backend/src/services/projects.ts`
  - `backend/src/services/users.ts`
  - `backend/src/scripts/migrate-project-assets.ts`
  - `backend/src/scripts/backfill-media-references.ts`（新增）
  - `frontend/src/composables/useAdminFetch.ts`
  - `frontend/src/composables/useAuth.ts`
  - `frontend/src/views/SubmitProjectView.vue`
  - `frontend/src/views/admin/ProjectsView.vue`

## ADDED Requirements
### Requirement: 存储策略配置化与统一上传契约
系统 SHALL 通过可配置存储策略处理媒体写入与读取，并在上传接口返回统一契约 `url`、`media_id`、`storage_key`。

#### Scenario: 上传接口返回统一字段
- **WHEN** 客户端调用 `/api/upload` 或 `/api/user/avatar` 上传媒体
- **THEN** 响应包含 `url`、`media_id`、`storage_key` 且三者可用于后续展示、引用写入与追踪

#### Scenario: 读取链路遵循配置前缀
- **WHEN** 客户端访问上传媒体公开地址
- **THEN** 路由解析与文件读取遵循 `publicPrefix` 与存储 key 规则，不依赖硬编码目录

### Requirement: 业务写路径 media_references 闭环
系统 SHALL 在项目、头像、故事相关写操作中写入或更新 `media_references`，并保证幂等。

#### Scenario: 项目写入触发引用补齐
- **WHEN** 项目创建、更新或审核通过涉及媒体字段
- **THEN** 系统为对应媒体资产写入项目实体引用记录，重复执行不产生重复脏数据

#### Scenario: 头像与故事写入触发引用补齐
- **WHEN** 用户更新头像或故事写入封面/正文媒体资源
- **THEN** 系统写入对应用户或故事实体引用记录，并可在管理端反查

### Requirement: 历史数据一次性回填
系统 SHALL 提供可重复执行的回填脚本，扫描历史业务数据并补齐引用。

#### Scenario: 回填脚本幂等执行
- **WHEN** 运维执行 `backfill-media-references` 脚本
- **THEN** 脚本仅补齐缺失引用，不破坏既有正确数据，并输出统计结果

#### Scenario: 回填与路径迁移协同
- **WHEN** 历史资产路径迁移已执行或同时执行
- **THEN** 回填写入的引用与新存储策略 URL 保持一致

### Requirement: 前端 canonical 收口与 media_id 接入
系统 SHALL 统一前端媒体字段形态并消费 `media_id`，不保留长期兼容 fallback。

#### Scenario: 项目编辑与提交统一字段
- **WHEN** 用户在提交页或管理端编辑项目媒体字段
- **THEN** 前端仅使用 canonical 字段并按新契约提交，不依赖旧字段兜底

#### Scenario: 管理端 URL 规则严格且可见失败
- **WHEN** 管理端处理不符合新前缀规则的媒体 URL
- **THEN** 前端给出明确错误提示，不执行静默清空

### Requirement: 验收闸门
系统 SHALL 以量化指标作为迁移上线前置条件。

#### Scenario: 指标满足后放行
- **WHEN** 上传成功率、项目图片保留率、头像更新成功率达到 100%，且 `media_references` 覆盖率与孤儿资产率达到阈值
- **THEN** 迁移方案可进入上线

## MODIFIED Requirements
### Requirement: 管理端媒体反查返回定位信息
管理端媒体反查接口在保留现有路由语义的前提下，返回包含实体类型、实体 ID、字段来源与必要展示信息的结构化引用数据。

#### Scenario: 反查结果可直接定位实体
- **WHEN** 管理员访问 `/api/admin/media/:id/references`
- **THEN** 响应可直接用于跳转或定位到项目、用户或故事对应实体

## REMOVED Requirements
### Requirement: 长期旧路径兼容与双写窗口
**Reason**: 与一次性迁移目标冲突，长期保留会增加实现分叉、运维复杂度与数据不一致风险。
**Migration**: 通过阶段化实施（存储配置化→引用闭环→历史回填→前端收口）与验收闸门替代长期兼容策略。
