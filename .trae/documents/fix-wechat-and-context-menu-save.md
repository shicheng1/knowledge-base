# 微信文章保存 + 右键 txt 保存 Bug 修复计划

## 问题分析

### Bug 1: 微信公众号文章保存到知识库没效果

**根因分析**（多层级问题）：

1. **background.js 不使用 content.js**：右键菜单点击时，`background.js` 通过 `chrome.scripting.executeScript` 注入了一个内联函数来获取页面内容，**完全没有调用 `content.js` 中定义的 `getPageContent()` / `getWechatArticleContent()` 函数**。所以微信文章的特殊提取逻辑（`#js_content`、`#activity-name` 等）根本没有被执行。

2. **消息格式不匹配**：`background.js` 发送给 Native Messaging Host 的消息格式是 `{ action: 'savePage', data: { ... } }`，但 `native-messaging.ts` 中的 `handleSavePage` 期望的消息类型是 `type: 'save-page'`，且 `data` 字段中需要 `isWechat`、`images`、`author`、`publishDate` 等字段。当前 `background.js` 发送的数据中缺少这些字段。

3. **NativeMessage 类型定义不完整**：`NativeMessage` 的 `data` 类型中没有 `isWechat`、`images`、`author`、`publishDate` 字段，TypeScript 类型层面就不支持微信文章数据。

4. **handleSavePage 的微信分支逻辑**：`native-messaging.ts` 中的 `handleSavePage` 检查 `data.isWechat`，但由于上面的问题，这个值永远不会为 true。

**修复方案**：
- 修改 `background.js`：右键菜单和 popup 保存时，先通过 `chrome.scripting.executeScript` 调用 `content.js` 中已定义的 `getPageContent()` 函数，获取包含 `isWechat`、`images`、`author` 等字段的完整数据
- 修改 `NativeMessage` 类型：添加 `isWechat`、`images`、`author`、`publishDate` 字段
- 修改 `handleSavePage`：正确传递微信文章数据（title、author、publishDate 等）

### Bug 2: 右键将 txt 文件保存到知识库报错

**根因**：右键菜单注册的命令是 `"${exePath}" --save-file "%1"`，这会启动一个新的应用实例。当应用已打包（`app.isPackaged = true`）时，`electron-vite` 的 `externalizeDepsPlugin()` 把 `mysql2` 等依赖外部化了，但打包后的应用在 `app.asar` 内找不到这些模块。

但更直接的问题是错误信息：`ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".txt"`。这说明 Node.js 尝试将 `.txt` 文件作为 ESM 模块加载。查看 `index.ts` 中的 `handleSaveFile` 函数，它使用 `import()` 动态导入模块：

```typescript
const { importFromHtml } = await import('../services/import-service')
```

当 `--save-file` 参数触发时，应用通过 `second-instance` 事件或 `did-finish-load` 回调调用 `handleSaveFile`。但错误提示是 `.txt` 文件被当作 ESM 模块加载了——这说明 `--save-file` 参数触发了新实例启动，而新实例的 `process.argv` 中包含了 `.txt` 文件路径，被 electron-vite 的模块解析器误处理了。

**实际根因**：打包后的应用，`--save-file` 参数传递的文件路径（如 `C:\Users\59458\Desktop\数据库信息.txt`）被 Electron/Vite 的 ESM 加载器错误地当作模块路径解析了。这是因为 `host.bat` 中的命令行参数传递方式有问题，或者应用启动时的模块解析逻辑有问题。

更具体地说，`electron-vite` 的 `externalizeDepsPlugin()` 在 CJS 模式下（`formats: ['cjs']`），打包后的代码中使用 `import()` 动态导入时，Node.js 会尝试用 ESM 解析器解析路径，导致 `.txt` 扩展名报错。

**修复方案**：
- 将 `handleSaveFile` 中的动态 `import()` 改为静态 `import`（已在文件顶部导入），避免 ESM 解析问题
- 确保所有动态 `import()` 在 `native-messaging.ts` 中也改为静态导入（该文件在独立进程中运行，需要动态导入来延迟加载数据库连接，但可以改为条件静态导入）

---

## 实施步骤

### Step 1: 修复 background.js - 使用 content.js 获取页面内容

修改 `extension/background.js`：
- 右键菜单点击时，通过 `chrome.scripting.executeScript` 调用 `content.js` 中已定义的 `getPageContent()` 函数
- 将获取到的完整数据（包含 `isWechat`、`images`、`author`、`publishDate`）传递给 Native Messaging Host
- popup 保存时同样使用 `content.js` 的 `getPageContent()`

### Step 2: 修复 NativeMessage 类型 + handleSavePage 逻辑

修改 `src/main/services/native-messaging.ts`：
- `NativeMessage.data` 类型添加 `isWechat`、`images`、`author`、`publishDate` 字段
- `handleSavePage` 正确处理微信文章数据，传递 title/author/publishDate 到 `importFromHtml`

### Step 3: 修复 index.ts 中的动态 import 问题

修改 `src/main/index.ts`：
- `handleSaveFile` 中移除动态 `import()`，改用已静态导入的模块
- 确保所有主进程代码不使用动态 `import()`

### Step 4: 修复 native-messaging.ts 中的动态 import

修改 `src/main/services/native-messaging.ts`：
- 将 `handleSavePage`、`handleGetFolders`、`handleGetTags` 中的动态 `import()` 改为静态 `import`
- Native Messaging Host 在独立进程中运行，需要在启动时初始化数据库连接

### Step 5: 构建验证

运行 `npm run build` 确认无编译错误。
