# Tasks

- [x] Task 1: 后端翻译服务 — 新增 translate-service.ts
  - [x] SubTask 1.1: 新建 `src/main/services/translate-service.ts`，实现 `translateText` 方法
  - [x] SubTask 1.2: 实现 `translateFeedItem` 方法，翻译结果缓存到 metadata

- [x] Task 2: 后端 GitHub Trending 拉取 — 替换 fetchGitHubStars
  - [x] SubTask 2.1: 新增 `fetchGitHubTrending()` 方法
  - [x] SubTask 2.2: 修改 `refreshSource()` 中 github 分支
  - [x] SubTask 2.3: 删除 `fetchGitHubStars` 和 `getGitHubToken`，新增 `GitHubTrendingItem`
  - [x] SubTask 2.4: 修改 `importFeedItem()` 增加 items 表去重

- [x] Task 3: 后端 IPC 修改
  - [x] SubTask 3.1: 替换 syncGitHubStars 为 syncGitHubTrending，新增 feed:translateItem
  - [x] SubTask 3.2: 确认注册

- [x] Task 4: Preload & 前端 API 修改
  - [x] SubTask 4.1: 修改 preload/index.ts
  - [x] SubTask 4.2: 修改 preload/types.ts
  - [x] SubTask 4.3: 修改 api.ts

- [x] Task 5: 前端 FeedView 翻译功能
  - [x] SubTask 5.1: 新增翻译按钮和翻译显示
  - [x] SubTask 5.2: 翻译状态管理

- [x] Task 6: 前端设置页面修改
  - [x] SubTask 6.1: 替换 GitHub Token 为 GitHub Trending 按钮

- [x] Task 7: 数据库迁移 011
  - [x] SubTask 7.1: 新增迁移 011 更新 github 类型源

# Task Dependencies
- [Task 2] depends on [Task 1] 无依赖，可并行
- [Task 3] depends on [Task 1, Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4]
- [Task 7] 无依赖，可并行
