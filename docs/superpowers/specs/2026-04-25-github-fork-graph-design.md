# GitHub Fork Network Graph Design

## 1. 需求与问题背景
用户反馈当前手动维护的 `parent` 字段逻辑存在两个严重问题：
1. **关系错乱**：把没有直接派生关系（例如只是插件或者竞品）的项目也强行算成了血缘关系。
2. **挂一漏万**：很多真正通过 Fork 产生的项目并没有被手动收录进去。

**用户的明确要求**：废弃手动维护，直接通过 GitHub API 获取项目的真实 Fork 关系和提交记录，以构建最真实的项目演化生态图谱。

## 2. 架构设计 (Architecture)

我们要将现有的“伪”血缘图彻底重构成“真实的 GitHub 网络图谱”。这分为后端数据抓取与前端渲染两部分。

### 2.1 后端数据抓取 (Python 脚本改造)
修改 `backend/src/update_github_stats.py`，在原有的获取 Repo 基础信息的逻辑上，增加对 GitHub API `source` 和 `parent` 的解析。

当通过 `https://api.github.com/repos/{owner}/{repo}` 获取一个仓库信息时，如果它是一个 Fork 仓库，GitHub API 的返回值中会包含：
*   `fork`: boolean (true/false)
*   `parent`: 对象，指向其直接的父仓库 (例如你 fork 的那个仓库)
*   `source`: 对象，指向整个 Fork 网络的源头仓库 (Root 仓库)

**数据结构更新 (`data.json`)**:
我们要移除手动填写的 `parent` 字符串字段，改为让脚本自动填充以下真实的 GitHub 关系数据：
```json
{
  "github_is_fork": true,
  "github_parent_url": "https://github.com/OriginalOwner/OriginalRepo",
  "github_source_url": "https://github.com/RootOwner/RootRepo"
}
```

### 2.2 前端图谱渲染重构
由于我们现在有真实的 `github_parent_url`，我们可以通过 URL 而不是应用名称（Name）来精确匹配项目关系。
这可以完美避免“把别人的插件当成父项目”的尴尬情况，因为只有真正在 GitHub 上发生过 Fork 的仓库才会被连线。

在 `ProjectLineageGraph.vue` 或未来的 `GlobalEcosystemGraph.vue` 中：
*   **匹配规则**：如果项目 B 的 `github_parent_url` 等于项目 A 的 `github_url`，那么 B 就是 A 的子节点。
*   不在我们 `data.json` 数据库中的 Fork 仓库不会被渲染（或者作为“外部未知节点”幽灵渲染，但为了简洁，只渲染收录的项目）。

## 3. 下一步规划
根据用户的多选（A, B, C）以及这个强烈反馈，接下来的工作流应该是：
1. **(首要任务)** 废弃手动 `parent`，重写 Python 脚本去抓取真实的 Fork 关系。
2. 将这个真实的树状结构在全局（图谱页）和详情页都做精准的渲染（对应选项A）。
3. 设计并实现荣誉徽章系统（对应选项B）。
4. 实现软件横向对比功能（对应选项C）。
