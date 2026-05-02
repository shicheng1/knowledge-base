# Tasks

- [x] Task 1: 数据库迁移 - 新增 reading_progress 字段
  - [x] SubTask 1.1: 在 `src/main/database/migrations/index.ts` 中新增 009_reading_progress 迁移，为 items 表添加 `reading_progress DECIMAL(5,2) NOT NULL DEFAULT 0.00` 列

- [x] Task 2: 后端 - item.repo 支持 reading_progress
  - [x] SubTask 2.1: 修改 `item.repo.ts` 的 findById，确保返回 reading_progress 字段
  - [x] SubTask 2.2: 在 `item.repo.ts` 新增 `saveReadingProgress(id, progress)` 方法

- [x] Task 3: 后端 - 新增 IPC 通道
  - [x] SubTask 3.1: 在 `src/main/ipc/item.ipc.ts` 新增 `item:saveReadingProgress` 通道，接收 itemId 和 progress 参数
  - [x] SubTask 3.2: 在 `src/preload/index.ts` 的 item 对象中新增 `saveReadingProgress` API

- [x] Task 4: 前端 - ItemDetailView 阅读进度功能
  - [x] SubTask 4.1: 添加滚动监听，计算当前阅读百分比（scrollHeight - clientHeight 为总可滚动距离，scrollTop / 总可滚动距离 = 百分比）
  - [x] SubTask 4.2: 实现防抖保存（3 秒间隔），调用 `window.api.item.saveReadingProgress`
  - [x] SubTask 4.3: 页面加载完成后，根据 item.reading_progress 自动滚动到对应位置
  - [x] SubTask 4.4: 在详情页顶部添加阅读进度条 UI（固定定位，高度 3px，蓝色）

- [x] Task 5: 替换应用图标
  - [x] SubTask 5.1: 将 `d:\07-person\knowledge-base\knowledge-base\f99bb093-cdae-4cb1-a675-bb37ff8b1f6b.png` 复制到 `resources/icon.png`
  - [x] SubTask 5.2: 确认 `window.ts` 和 `package.json` 中图标配置正确引用 resources/icon.png

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 is independent (can run in parallel)
