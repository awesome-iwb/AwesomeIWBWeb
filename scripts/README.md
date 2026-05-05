# 脚本目录说明

## 分层

- `scripts/migration/`：一次性迁移脚本
- `scripts/ops/`：日常运维与校验脚本
- `scripts/deploy/`：部署辅助脚本

## 兼容入口

为兼容旧命令，仓库根 `scripts/` 下保留了少量同名入口文件，这些入口会转发到新分层目录。

