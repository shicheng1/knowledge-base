# Tasks

- [x] Task 1: 数据库迁移 — 创建 feed_sources 和 feed_items 表，扩展 items.source_type
  - [x] SubTask 1.1: 在 `src/main/database/migrations/index.ts` 中添加迁移 010_feed_sources_and_items，创建 feed_sources 表（id, name, url, type ENUM('rss','github'), description, icon_url, site_url, enabled, fetch_interval_minutes, last_fetched_at, created_at, updated_at）和 feed_items 表（id, source_id, title, url, summary, author, published_at, content_hash, imported_item_id, metadata JSON, is_read, created_at），并 ALTER items.source_type 枚举新增 'rss' 和 'github'
  - [x] SubTask 1.2: 在 `src/main/database/types.ts` 中添加 FeedSource、FeedItem 接口定义，以及 CreateFeedSourceDTO、FeedQueryOptions 等类型，扩展 SourceType 加入 'rss' | 'github'

- [x] Task 2: 后端 Feed 服务 — RSS 解析与 GitHub Star 同步
  - [x] SubTask 2.1: 安装 RSS 解析依赖 `rss-parser`（npm install rss-parser && npm install -D @types/rss-parser）
  - [x] SubTask 2.2: 新建 `src/main/services/feed-service.ts`，实现 fetchRssFeed(source) 方法：使用 rss-parser 解析 RSS/Atom Feed，返回解析后的条目列表
  - [x] SubTask 2.3: 在 feed-service.ts 中实现 fetchGitHubStars(token, existingUrls) 方法：调用 GitHub API `GET /user/starred` 获取 Star 列表，过滤已存在的仓库，返回新 Star 条目
  - [x] SubTask 2.4: 在 feed-service.ts 中实现 refreshAllSources() 方法：遍历所有启用的 feed_sources，根据 last_fetched_at 和 fetch_interval_minutes 判断是否需要拉取，调用对应方法获取新条目，去重后存入 feed_items
  - [x] SubTask 2.5: 在 feed-service.ts 中实现 importFeedItem(feedItemId, folderId?) 方法：将 feed_item 的 URL 传入 content-extractor 提取完整内容，创建 items 记录，更新 feed_item.imported_item_id
  - [x] SubTask 2.6: 在 feed-service.ts 中实现 batchImportFeedItems(feedItemIds, folderId?) 方法：批量入库，逐条调用 importFeedItem

- [x] Task 3: 后端 Feed 数据仓库 — feed.repo.ts
  - [x] SubTask 3.1: 新建 `src/main/database/repositories/feed.repo.ts`，实现 feed_sources CRUD：create, update, delete, findAll, findById, findByType, toggleEnabled
  - [x] SubTask 3.2: 在 feed.repo.ts 中实现 feed_items 查询：findItems(options) 支持分页、按 source_id/type/关键词/已入库状态筛选，findItemByUrl（去重用），markAsImported，markAsRead，deleteBySourceId，deleteOldItems（清理超过 30 天的未入库条目）

- [x] Task 4: 后端 IPC — feed.ipc.ts
  - [x] SubTask 4.1: 新建 `src/main/ipc/feed.ipc.ts`，注册 IPC handlers：feed:getSources, feed:addSource, feed:updateSource, feed:deleteSource, feed:toggleSource, feed:getItems, feed:importItem, feed:batchImport, feed:refreshAll, feed:refreshSource, feed:syncGitHubStars, feed:getPresetSources
  - [x] SubTask 4.2: 在 `src/main/ipc/index.ts` 中导入并注册 registerFeedHandlers

- [x] Task 5: Preload API — 暴露 feed 相关方法到渲染进程
  - [x] SubTask 5.1: 在 `src/preload/index.ts` 中添加 feed 命名空间的 API：getSources, addSource, updateSource, deleteSource, toggleSource, getItems, importItem, batchImport, refreshAll, refreshSource, syncGitHubStars, getPresetSources

- [x] Task 6: 前端 API 封装 — api.ts 中添加 feedApi
  - [x] SubTask 6.1: 在 `src/renderer/src/lib/api.ts` 中添加 feedApi 对象，封装所有 feed 相关的 window.api.feed 调用

- [x] Task 7: 前端知识流视图 — FeedView.tsx
  - [x] SubTask 7.1: 新建 `src/renderer/src/views/FeedView.tsx`，实现知识流主页面：顶部筛选栏（来源类型切换：全部/RSS/GitHub、订阅源下拉、搜索框、刷新按钮），条目列表（卡片式布局，每条显示来源图标、标题、摘要、发布时间、来源名称、入库状态），底部加载更多/分页
  - [x] SubTask 7.2: 实现单条入库：每条 feed_item 右侧"入库"按钮，点击后弹出文件夹选择器，确认后调用 importItem API
  - [x] SubTask 7.3: 实现批量入库：勾选多条后顶部出现批量操作栏，点击"批量入库"弹出文件夹选择器，确认后调用 batchImport API，显示进度
  - [x] SubTask 7.4: 实现手动刷新：点击刷新按钮调用 refreshAll API，刷新期间显示 loading 状态

- [x] Task 8: 前端路由与导航
  - [x] SubTask 8.1: 在 `src/renderer/src/App.tsx` 中添加 `/feed` 路由指向 FeedView
  - [x] SubTask 8.2: 在 `src/renderer/src/components/layout/Sidebar.tsx` 中添加"知识流"导航入口（使用 Rss 图标），位于"收藏"和"知识图谱"之间

- [x] Task 9: 前端设置页面 — 知识来源配置区域
  - [x] SubTask 9.1: 在 `src/renderer/src/views/SettingsView.tsx` 中新增"知识来源"配置区域：RSS 订阅源管理（添加 URL、编辑名称/拉取间隔、删除、启用/禁用开关），预置 AI 订阅源一键添加列表，GitHub Token 配置（输入 PAT、验证、同步按钮）
  - [x] SubTask 9.2: 实现预置 AI 订阅源展示：从 feed:getPresetSources 获取预置列表，展示名称和描述，点击"添加"后调用 addSource

- [x] Task 10: 定时拉取与启动自动刷新
  - [x] SubTask 10.1: 在 `src/main/index.ts` 中，应用启动且数据库初始化完成后，调用 feed-service 的 refreshAllSources() 执行首次拉取
  - [x] SubTask 10.2: 在 feed-service.ts 中实现 setInterval 定时器，默认每 60 分钟执行一次 refreshAllSources（可在设置中调整间隔）

# Task Dependencies
- [Task 2] depends on [Task 1] (需要数据库表和类型定义)
- [Task 3] depends on [Task 1] (需要数据库表和类型定义)
- [Task 4] depends on [Task 2, Task 3] (IPC 调用 service 和 repo)
- [Task 5] depends on [Task 4] (preload 暴露 IPC 方法)
- [Task 6] depends on [Task 5] (API 封装依赖 preload)
- [Task 7] depends on [Task 6] (视图依赖 API)
- [Task 8] depends on [Task 7] (路由依赖视图组件)
- [Task 9] depends on [Task 6] (设置页依赖 API)
- [Task 10] depends on [Task 2] (定时器依赖 service)
