# 修复文件导入 Bug 计划

## 问题分析

用户报告了两个 bug：
1. **添加 .txt 文件报 "unknown file extension .txt" 错误**
2. **添加 HTML 文件只是新打开窗口，没有添加到知识库目录**

经过代码审查，发现了以下根本原因：

### Bug 1: .txt 文件导入失败

**根因**：`import-service.ts` 的 `importFromFile` 函数中，`fileManager` 没有被初始化（`rootPath` 为 `null`）。当导入非文档类文件时（第 138-140 行），会调用 `fileManager.ensureDirectory()` 和 `fileManager.importFile()`，但 `fileManager.setRootDirectory()` 从未被调用过，导致 `ensureRoot()` 抛出异常 "Root directory has not been set"。

而 `.txt` 文件走的是文档分支（第 88-136 行），该分支直接用 `fs.readFile` 读取文件内容，不依赖 `fileManager`。但问题在于 `importFromFile` 被调用时传入的 `filePath` 可能是原始路径而非存储路径——在 `file:importByDrag` IPC handler 中，文件先被复制到 `storageDir`（由 `getStorageRootPath()` 返回），然后传给 `importFromFile`。但 `importFromFile` 内部对于文档文件又尝试用 `fileManager` 去导入，而 `fileManager` 的 rootPath 未设置。

实际上仔细看代码流程：
- `file:importByDrag` 已经将文件复制到 storage 目录，然后调用 `importFromFile(targetPath, folderId)`
- `importFromFile` 对 `.txt` 文件走文档分支，直接 `fs.readFile(filePath, 'utf-8')` 读取，然后 `itemRepo.create()` —— 这条路径应该可以工作
- 但如果 `itemRepo.create()` 报错，可能是因为数据库的 `source_type` 枚举值不匹配

**真正的根因**：数据库 schema 中 `source_type` 的 ENUM 值是 `('web', 'file', 'clipboard', 'api', 'import', 'manual')`，但 TypeScript `types.ts` 中定义的 `SourceType` 是 `'browser' | 'file_explorer' | 'manual' | 'import' | 'api'`。`import-service.ts` 传了 `sourceType: 'file_explorer'`，数据库不接受这个值，INSERT 会失败！

### Bug 2: HTML 文件打开新窗口而非导入

**根因**：`window.ts` 第 56-58 行的 `will-navigate` 事件处理器：
```typescript
mainWindow.webContents.on('will-navigate', (event) => {
  event.preventDefault();
});
```
这个处理器阻止了**所有**导航，包括应用自身的路由导航。当 HTML 文件被拖入窗口时，Electron 会尝试导航到该文件 URL，被 `preventDefault()` 阻止了。但更关键的是，这个全局阻止可能干扰了应用内部的路由。

实际上 HTML 文件拖入时，Electron 的默认行为是在窗口中打开该文件（导航到 `file:///...`），而不是触发 HTML5 drop 事件。`will-navigate` 阻止了导航，但文件拖入的默认行为也覆盖了 HTML5 drag-and-drop 事件，导致 drop 事件根本不会触发。

### Bug 3: 渲染进程 CONTENT_TYPE_MAP 与数据库不一致

`HomeView.tsx`、`FolderView.tsx`、`SearchView.tsx` 中的 `CONTENT_TYPE_MAP` 使用旧值 `webpage/document/video/work`，而数据库实际存储的是 `note/article/bookmark/file/code/image/other`。这导致新导入的条目在 UI 上显示为原始 content_type 字符串而非友好标签。

## 修复方案

### 修复 1: 统一 source_type 枚举值（关键修复）

**文件**: `src/main/database/types.ts`
- 将 `SourceType` 从 `'browser' | 'file_explorer' | 'manual' | 'import' | 'api'` 改为与数据库一致的 `'web' | 'file' | 'clipboard' | 'api' | 'import' | 'manual'`

**文件**: `src/main/services/import-service.ts`
- `importFromUrl`: `sourceType` 改为 `'web'`
- `importFromFile`: `sourceType` 改为 `'file'`
- `importFromHtml`: `sourceType` 改为 `'web'`

**文件**: `src/main/index.ts`
- `handleSaveFile`: `sourceType` 改为 `'file'`

### 修复 2: 修复 will-navigate 事件处理

**文件**: `src/main/window.ts`
- 修改 `will-navigate` 处理器，只阻止外部 URL 导航，允许应用内部路由
- 判断逻辑：如果 URL 以 `file://` 开头且不是应用自身的 index.html，则阻止；如果 URL 是开发服务器地址则允许

```typescript
mainWindow.webContents.on('will-navigate', (event, url) => {
  // 允许开发服务器 HMR 和应用内部路由
  if (is.dev && url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '')) {
    return;
  }
  // 允许应用自身的 file:// 路由
  if (url.startsWith('file://') && !url.includes('/storage/')) {
    return;
  }
  // 阻止其他导航（如拖入文件导致的导航）
  event.preventDefault();
});
```

### 修复 3: 更新渲染进程 CONTENT_TYPE_MAP

**文件**: `src/renderer/src/views/HomeView.tsx`
**文件**: `src/renderer/src/views/FolderView.tsx`
**文件**: `src/renderer/src/views/SearchView.tsx`

将 `CONTENT_TYPE_MAP` 更新为与数据库枚举一致：
```typescript
const CONTENT_TYPE_MAP = {
  note: { label: '笔记', color: 'bg-yellow-100 text-yellow-700', icon: StickyNote },
  article: { label: '文章', color: 'bg-purple-100 text-purple-700', icon: BookOpen },
  bookmark: { label: '书签', color: 'bg-blue-100 text-blue-700', icon: Globe },
  file: { label: '文件', color: 'bg-green-100 text-green-700', icon: FileText },
  code: { label: '代码', color: 'bg-indigo-100 text-indigo-700', icon: FileCode },
  image: { label: '图片', color: 'bg-pink-100 text-pink-700', icon: Image },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700', icon: Briefcase },
};
```

### 修复 4: 修复 importFromFile 中 fileManager 未初始化问题

**文件**: `src/main/services/import-service.ts`
- 对于非文档文件分支（第 137-157 行），`fileManager` 的 `rootPath` 未设置会导致错误
- 改为使用 `getStorageRootPath()` + `fs` 直接操作，与 `handleSaveFile` 和 `file:importByDrag` 保持一致
- 移除对 `fileManager` 的依赖

### 修复 5: 修复 file:importByDrag 中文件已被复制但 importFromFile 又尝试读取原始路径的问题

**文件**: `src/main/ipc/file.ipc.ts`
- 当前 `file:importByDrag` 先复制文件到 storage，然后调用 `importFromFile(targetPath)`
- 但 `importFromFile` 对文档文件又直接从 `filePath` 读取内容，对非文档文件又尝试用 `fileManager` 导入
- 由于文件已被复制，`importFromFile` 应该只负责创建数据库记录，不再重复复制文件
- 需要给 `importFromFile` 增加一个参数或创建新函数来处理"文件已在存储目录"的情况

## 实施步骤

1. 修复 `types.ts` 中 `SourceType` 枚举值，与数据库 schema 对齐
2. 修复 `import-service.ts` 中所有 `sourceType` 引用，移除 `fileManager` 依赖
3. 修复 `index.ts` 中 `handleSaveFile` 的 `sourceType`
4. 修复 `window.ts` 中 `will-navigate` 事件处理逻辑
5. 更新三个 View 文件的 `CONTENT_TYPE_MAP`
6. 修复 `file:importByDrag` IPC handler，避免重复文件操作
