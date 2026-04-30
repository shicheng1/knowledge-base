# 个人知识库导入功能优化与拖拽支持 Spec

## Why
当前知识库的数据导入流程存在多个严重问题：右键菜单保存功能与数据库层脱节、浏览器插件通信协议实现错误、import-service 使用占位代码未接入真实数据库，同时缺少拖拽导入这一核心交互方式。这些问题导致用户无法可靠地将数据添加到知识库。

## What Changes
- 修复右键菜单保存流程：统一使用 `item.repo` 数据层替代 `handleSaveFile` 中的直接 SQL
- 修复浏览器插件 Native Messaging 通信：主进程的 `startNativeMessagingHost` 改用 `native-messaging.ts` 中的协议实现
- 重构 `import-service.ts`：移除占位 `db` 对象，接入真实数据库操作
- 修复 HTTP Server：使其使用真实数据库而非占位代码
- 修复 content_type 映射不一致问题：统一使用数据库 schema 定义的枚举值
- 新增拖拽导入功能：Electron 主进程监听文件拖放事件，渲染进程提供拖放区域 UI
- 新增导入进度反馈：右键保存和拖拽导入后通知渲染进程刷新列表

## Impact
- Affected specs: 数据导入流程、右键菜单集成、浏览器插件通信、文件管理
- Affected code:
  - `src/main/index.ts` — 右键保存逻辑、Native Messaging 启动逻辑
  - `src/main/services/import-service.ts` — 核心重构，接入真实数据库
  - `src/main/services/native-messaging.ts` — 被 index.ts 正确引用
  - `src/main/integrations/http-server.ts` — 使用重构后的 import-service
  - `src/main/window.ts` — 添加拖放事件处理
  - `src/main/ipc/file.ipc.ts` — 新增拖拽导入 IPC
  - `src/preload/index.ts` — 暴露拖拽相关 API
  - `src/renderer/src/views/HomeView.tsx` — 添加拖放区域 UI
  - `src/renderer/src/views/FolderView.tsx` — 添加拖放区域 UI
  - `src/renderer/src/lib/api.ts` — 新增拖拽导入 API

## ADDED Requirements

### Requirement: 拖拽文件导入
系统 SHALL 支持将文件从系统资源管理器拖拽到知识库窗口中进行导入。

#### Scenario: 拖拽单个文件到知识库
- **WHEN** 用户将一个文件从资源管理器拖拽到知识库主窗口
- **THEN** 系统显示拖放提示区域，松开鼠标后自动将文件导入知识库
- **AND** 导入完成后列表自动刷新，显示新条目

#### Scenario: 拖拽多个文件到知识库
- **WHEN** 用户将多个文件同时拖拽到知识库窗口
- **THEN** 系统依次处理所有文件，每个文件创建一个知识条目
- **AND** 全部导入完成后显示导入结果摘要

#### Scenario: 拖拽文件到指定文件夹
- **WHEN** 用户在文件夹视图下拖拽文件到知识库窗口
- **THEN** 导入的条目自动归属到当前文件夹

#### Scenario: 拖拽过程中显示视觉反馈
- **WHEN** 文件被拖拽到窗口上方（尚未松开）
- **THEN** 窗口显示半透明覆盖层提示"释放以导入文件"
- **WHEN** 文件被拖离窗口
- **THEN** 覆盖层消失，恢复正常状态

### Requirement: 导入进度与结果通知
系统 SHALL 在文件导入过程中提供进度反馈和结果通知。

#### Scenario: 右键菜单保存成功通知
- **WHEN** 通过右键菜单成功保存文件到知识库
- **THEN** 渲染进程收到 `item-created` 事件并自动刷新列表
- **AND** 主窗口自动前置并获得焦点

#### Scenario: 导入失败通知
- **WHEN** 文件导入过程发生错误
- **THEN** 系统在渲染进程中显示错误提示信息
- **AND** 不影响已有数据的完整性

### Requirement: 拖拽导入 IPC 通道
系统 SHALL 提供拖拽文件导入的 IPC 通信通道。

#### Scenario: 渲染进程发起拖拽导入
- **WHEN** 渲染进程通过 `file:importByDrag` IPC 通道发送文件路径列表
- **THEN** 主进程逐个处理文件，返回导入结果列表
- **AND** 每个结果包含成功/失败状态和条目 ID 或错误信息

## MODIFIED Requirements

### Requirement: 右键菜单保存功能
原实现中 `handleSaveFile` 直接使用 `pool.execute()` 执行 SQL，绕过了数据层。修改为通过 `item.repo` 进行数据库操作，确保数据一致性和业务逻辑统一。

修改要点：
1. 移除 `handleSaveFile` 中的直接 SQL 操作
2. 改用 `itemRepo.create()` 创建条目
3. 修复 content_type 映射：使用数据库 schema 定义的枚举值（`note`, `article`, `bookmark`, `file`, `code`, `image`, `other`）而非自定义值（`document`, `video`）
4. 文件复制逻辑统一使用 `file:importFile` IPC 的已有实现

### Requirement: 浏览器插件 Native Messaging 通信
原实现中 `index.ts` 的 `startNativeMessagingHost` 使用 `process.stdin.on('data')` 直接解析 JSON，不符合 Chrome Native Messaging 协议（需要 4 字节长度前缀）。修改为使用 `native-messaging.ts` 中已实现的 `readFullMessage` / `sendMessage` 协议方法。

修改要点：
1. `index.ts` 中 `startNativeMessagingHost` 改为调用 `native-messaging.ts` 导出的 `startNativeMessagingHost`
2. 消息处理逻辑复用 `native-messaging.ts` 中已有的 handler 分发
3. 保存操作改用重构后的 `import-service.ts`

### Requirement: Import Service 数据库接入
原 `import-service.ts` 使用占位 `db` 对象（`console.log` + `Date.now()` 作为 ID），未接入真实数据库。重构为使用 `item.repo` 和 `tag.repo` 进行真实数据库操作。

修改要点：
1. 移除占位 `db` 对象
2. `importFromUrl`、`importFromFile`、`importFromHtml` 改用 `itemRepo.create()` 和 `tagRepo` 方法
3. 文件存储统一使用 `fileManager`
4. content_type 映射与数据库 schema 保持一致

### Requirement: HTTP Server 数据库接入
原 `http-server.ts` 中 `handleGetTags` 返回硬编码标签数据。修改为使用真实数据库查询。

修改要点：
1. `handleGetTags` 改用 `tagRepo.getAll()`
2. `handleSavePage` 使用重构后的 `import-service.ts`
3. `handleGetFolders` 使用 `folderRepo` 替代 `fileManager.getDirectoryTree()`

## REMOVED Requirements

### Requirement: 占位数据库操作
**Reason**: `import-service.ts` 中的占位 `db` 对象仅用于开发调试，现已接入真实数据库。
**Migration**: 所有调用 `db.createItem`、`db.setItemTags`、`db.findOrCreateTag` 的代码改为使用 `itemRepo` 和 `tagRepo`。
