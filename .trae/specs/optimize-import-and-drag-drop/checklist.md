* [ ] import-service.ts 中占位 db 对象已移除，所有方法使用 itemRepo/tagRepo 进行真实数据库操作

* [ ] import-service.ts 中 content\_type 映射与数据库 schema 枚举值一致（note/article/bookmark/file/code/image/other）

* [ ] 右键菜单保存功能通过 itemRepo.create() 创建条目，不再使用直接 SQL

* [ ] 右键菜单保存成功后渲染进程收到 item-created 事件并自动刷新列表

* [ ] Native Messaging Host 使用 native-messaging.ts 中的协议实现（4字节长度前缀），不再使用 process.stdin.on('data') 直接解析

* [ ] HTTP Server 的 handleGetTags 返回真实数据库标签数据，不再返回硬编码值

* [ ] HTTP Server 的 handleGetFolders 使用 folderRepo 查询，不再使用 fileManager.getDirectoryTree()

* [ ] 拖拽文件到 HomeView 窗口可成功导入，条目出现在列表中

* [ ] 拖拽文件到 FolderView 窗口可成功导入，条目自动归属当前文件夹

* [ ] 拖拽多个文件时全部正确导入

* [ ] 拖拽过程中显示视觉反馈（半透明覆盖层提示"释放以导入文件"）

* [ ] 拖离窗口时覆盖层消失

* [ ] file:importByDrag IPC 通道在 preload 中正确暴露

* [ ] 导入失败时显示错误提示，不影响已有数据

* [ ] 组件卸载时正确清理事件监听器，无内存泄漏

