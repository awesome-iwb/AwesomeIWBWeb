# 历史资源目录说明

`images/` 为历史阶段遗留资源目录。网页化后，运行时静态资源应优先放在：

- `frontend/public/assets/`

## 规则

- 新资源默认不要再放入本目录。
- 旧路径迁移时，先补映射再替换引用，避免页面断图。
- 批量迁移请记录到 `docs/content/readme-migration.md`。

