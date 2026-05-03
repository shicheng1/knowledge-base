# Tasks

- [x] Task 1: 数据库层变更 - 添加 category 支持和批量删除
  - [x] SubTask 1.1: 在 `src/main/database/types.ts` 的 `FeedSource` 接口中新增 `category: string | null` 字段，`CreateFeedSourceDTO` 和 `UpdateFeedSourceDTO` 中新增 `category` 可选字段
  - [x] SubTask 1.2: 在 `src/main/database/repositories/feed.repo.ts` 的 `create` 方法中支持 `category` 字段写入，`update` 方法中支持 `category` 更新，`mapFeedSourceRow` 中映射 `category` 字段
  - [x] SubTask 1.3: 在 `feed.repo.ts` 中新增 `batchDelete(ids: number[])` 方法，批量删除 feed_sources 及关联的 feed_items
  - [x] SubTask 1.4: 在 `src/main/database/migrations/index.ts` 中新增迁移 `013_add_feed_source_category`，为 `feed_sources` 表添加 `category VARCHAR(100) NULL` 列

- [x] Task 2: 后端 IPC 层变更
  - [x] SubTask 2.1: 在 `src/main/ipc/feed.ipc.ts` 中新增 `feed:batchDeleteSources` handler，接收 `{ ids: number[] }`，调用 `feedRepo.batchDelete(ids)`
  - [x] SubTask 2.2: 修改 `feed:addSource` handler 的 DTO 类型，支持 `category` 字段传入
  - [x] SubTask 2.3: 修改 `feed:updateSource` handler 的 DTO 类型，支持 `category` 字段更新

- [x] Task 3: Preload 和 API 层变更
  - [x] SubTask 3.1: 在 `src/preload/index.ts` 的 `feed` 对象中新增 `batchDeleteSources: (ids: number[]) => invoke('feed:batchDeleteSources', { ids })`
  - [x] SubTask 3.2: 在 `src/preload/types.ts` 的 `FeedApi` 接口中新增 `batchDeleteSources` 方法签名
  - [x] SubTask 3.3: 在 `src/renderer/src/lib/api.ts` 的 `feedApi` 中新增 `batchDeleteSources` 方法，`addSource` 和 `updateSource` 参数中支持 `category`

- [x] Task 4: FeedView 页面重构 - 新增知识源管理视图
  - [x] SubTask 4.1: 在 FeedView 中添加 `viewMode` 状态（'items' | 'sources'），默认 'items'
  - [x] SubTask 4.2: 在页面顶部添加视图切换按钮：内容列表模式下显示"管理知识源"按钮，知识源管理模式下显示"返回知识流"按钮
  - [x] SubTask 4.3: 实现知识源管理视图 UI：包含添加源表单（名称、URL、类型、分类）、源列表展示（分类标签、名称、URL、启用开关、操作按钮）、分类筛选下拉框
  - [x] SubTask 4.4: 在知识源管理视图中实现多选复选框和批量删除功能（已选择提示栏 + 批量删除按钮 + 确认操作）
  - [x] SubTask 4.5: 实现单源删除（带确认）、启用/禁用切换、编辑分类功能
  - [x] SubTask 4.6: 知识源管理视图中保留 OPML 导入和预置源一键添加功能

- [x] Task 5: SettingsView 精简
  - [x] SubTask 5.1: 移除 SettingsView 中原有的完整知识源管理 UI（添加源表单、源列表、OPML 导入、预置源列表）
  - [x] SubTask 5.2: 保留 GitHub Trending 同步按钮
  - [x] SubTask 5.3: 新增"前往知识流管理知识源"按钮，使用 HashRouter 方式跳转到 `/feed`

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 3
- Task 5 与 Task 4 可并行
