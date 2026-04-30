# Tasks

- [x] Task 1: 重构 import-service.ts，接入真实数据库
  - [x] SubTask 1.1: 移除占位 `db` 对象，引入 `itemRepo` 和 `tagRepo`
  - [x] SubTask 1.2: 重写 `importFromUrl` 使用 `itemRepo.create()`，content_type 使用数据库枚举值
  - [x] SubTask 1.3: 重写 `importFromFile` 使用 `itemRepo.create()` + `fileManager`
  - [x] SubTask 1.4: 重写 `importFromHtml` 使用 `itemRepo.create()` + `tagRepo`
  - [x] SubTask 1.5: 统一 content_type 映射，与数据库 schema 枚举对齐（note/article/bookmark/file/code/image/other）

- [x] Task 2: 修复右键菜单保存流程
  - [x] SubTask 2.1: 重构 `handleSaveFile`，移除直接 SQL，改用 `itemRepo.create()`
  - [x] SubTask 2.2: 修复 content_type 映射，将 `document`→`file`、`video`→`other`（或新增 video 枚举）
  - [x] SubTask 2.3: 文件复制逻辑改用已有的 `file:importFile` 实现或 `fileManager`
  - [x] SubTask 2.4: 确保保存成功后通过 `mainWindow.webContents.send('item-created')` 通知渲染进程

- [x] Task 3: 修复 Native Messaging 通信协议
  - [x] SubTask 3.1: 修改 `index.ts` 中 `startNativeMessagingHost`，改为调用 `native-messaging.ts` 导出的函数
  - [x] SubTask 3.2: 确保 `native-messaging.ts` 中的 handler 使用重构后的 `import-service.ts`
  - [x] SubTask 3.3: 验证 Native Messaging Host 的 stdin/stdout 协议正确性（4字节长度前缀）

- [x] Task 4: 修复 HTTP Server 数据库接入
  - [x] SubTask 4.1: `handleGetTags` 改用 `tagRepo.getAll()` 替代硬编码数据
  - [x] SubTask 4.2: `handleGetFolders` 改用 `folderRepo` 替代 `fileManager.getDirectoryTree()`
  - [x] SubTask 4.3: `handleSavePage` 确保使用重构后的 `import-service.ts`

- [ ] Task 5: 实现拖拽导入 - 主进程侧
  - [ ] SubTask 5.1: 在 `window.ts` 中监听 `will-navigate` 和 `drop` 事件防止默认行为
  - [ ] SubTask 5.2: 新增 IPC handler `file:importByDrag`，接收文件路径数组，逐个调用 `importFromFile`
  - [ ] SubTask 5.3: 在 `preload/index.ts` 中暴露 `file.importByDrag` API
  - [ ] SubTask 5.4: 导入完成后发送 `item-created` 事件通知渲染进程刷新

- [ ] Task 6: 实现拖拽导入 - 渲染进程侧
  - [ ] SubTask 6.1: 在 `api.ts` 中新增 `fileApi.importByDrag` 方法
  - [ ] SubTask 6.2: 在 `HomeView.tsx` 中添加拖放区域，监听 dragenter/dragover/dragleave/drop 事件
  - [ ] SubTask 6.3: 在 `FolderView.tsx` 中添加拖放区域，拖入文件自动归属当前文件夹
  - [ ] SubTask 6.4: 实现拖放视觉反馈：拖入时显示半透明覆盖层，拖离时恢复
  - [ ] SubTask 6.5: 导入完成后自动刷新条目列表

- [ ] Task 7: 修复渲染进程监听 item-created 事件刷新列表
  - [ ] SubTask 7.1: 在 `HomeView.tsx` 中监听 `item-created` 事件，收到后重新加载列表
  - [ ] SubTask 7.2: 在 `FolderView.tsx` 中监听 `item-created` 事件，收到后重新加载列表
  - [ ] SubTask 7.3: 确保事件监听器在组件卸载时正确清理

# Task Dependencies
- [Task 2] depends on [Task 1] — 右键菜单修复需要 import-service 先接入真实数据库
- [Task 3] depends on [Task 1] — Native Messaging 修复需要 import-service 先接入真实数据库
- [Task 4] depends on [Task 1] — HTTP Server 修复需要 import-service 先接入真实数据库
- [Task 5] depends on [Task 1] — 拖拽导入主进程侧需要使用重构后的 import-service
- [Task 6] depends on [Task 5] — 渲染进程拖放 UI 依赖主进程 IPC 通道
- [Task 7] depends on [Task 2] — 事件刷新依赖右键菜单正确发送 item-created 事件
