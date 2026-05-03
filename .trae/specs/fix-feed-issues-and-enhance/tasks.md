# Tasks

- [x] Task 1: 修复 GitHub Trending HTML 解析正则
  - [x] SubTask 1.1: 修改 fetchGitHubTrending 的正则表达式，适配 GitHub 当前 HTML 结构

- [x] Task 2: 修复入库状态一致性 — 删除 items 时清除 imported_item_id
  - [x] SubTask 2.1: 在 feed.repo.ts 中新增 clearImportedItemId 方法
  - [x] SubTask 2.2: 在 item.repo.ts 的 delete 方法中调用 clearImportedItemId
  - [x] SubTask 2.3: 新增迁移 012 清理孤立 imported_item_id

- [x] Task 3: FeedView 标题点击改为软件内预览
  - [x] SubTask 3.1: 新增 previewUrl/previewTitle state，webview 预览面板，关闭和外部打开按钮

- [x] Task 4: OPML 导入功能
  - [x] SubTask 4.1: 在 feed-service.ts 中新增 parseOpmlAndImport 方法
  - [x] SubTask 4.2: 在 feed.ipc.ts 中新增 feed:importOpml handler
  - [x] SubTask 4.3: 在 preload/index.ts 中新增 importOpml
  - [x] SubTask 4.4: 在 preload/types.ts 中更新 FeedApi 接口
  - [x] SubTask 4.5: 在 api.ts 中更新 feedApi
  - [x] SubTask 4.6: 在 SettingsView.tsx 中新增"导入 OPML"按钮

# Task Dependencies
- [Task 2] depends on [Task 1] 无依赖，可并行
- [Task 3] 无依赖，可并行
- [Task 4] 无依赖，可并行
