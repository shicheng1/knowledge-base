# Markdown 编辑器 + Excel 筛选 + 右键菜单修复 实施计划

## 问题分析

### 问题 1：Markdown 文件需要用 Markdown 编辑器打开

**现状**：ItemDetailView.tsx 中，Markdown 文件（`.md`）的预览逻辑有问题：
- 当 `content_type === 'note'` 且有 `content_html` 时，用 TipTap 只读模式渲染 ✅
- 当 `content_type === 'note'` 且只有 `content`（无 `content_html`）时，用 ReactMarkdown 渲染 ✅
- **但是**：通过"新建 Markdown 文件"创建的条目，`content_html` 为空，`content` 也为空（空白文件），编辑时用 TipTap 编辑 HTML，保存后 `content` 字段存的是 HTML 而非 Markdown
- **核心问题**：Markdown 文件（`mime_type === 'text/markdown'` 或 `source_name` 以 `.md` 结尾）在查看模式应该用 TipTap 只读模式渲染，在编辑模式应该用 TipTap 编辑器。但目前条件判断 `!item.content_type?.includes('file')` 导致 `content_type === 'file'` 的 Markdown 文件不会走 TipTap 渲染路径

**修复方案**：
1. ItemDetailView 的预览逻辑增加：当 `mime_type === 'text/markdown'` 或 `source_name` 以 `.md` 结尾时，使用 TipTap 只读模式渲染
2. 编辑模式：Markdown 文件也使用 TipTap 编辑器
3. 保存时：如果是 Markdown 文件，同时更新磁盘上的 .md 文件内容

### 问题 2：Excel 预览需要支持筛选

**现状**：ExcelPreview 组件使用 `xlsx-preview` 库将 Excel 转为 HTML 表格，但只是静态渲染，不支持筛选。

**修复方案**：
替换 `xlsx-preview` 为 `exceljs` + 自定义表格渲染，实现：
1. 读取 Excel 数据后解析为结构化数据（行列值）
2. 第一行作为表头，每列添加筛选下拉按钮
3. 筛选功能：点击列头筛选按钮 → 显示该列所有唯一值 → 勾选/取消勾选 → 过滤显示行
4. 支持搜索筛选值
5. 保留多 Sheet 切换

### 问题 3：右键菜单保存不了

**现状分析**：右键菜单保存有两种路径：
1. **Windows 资源管理器右键** → 通过 `--save-file` 命令行参数 → `handleSaveFile()` → 需要注册 Windows 右键菜单（目前没有注册脚本）
2. **浏览器扩展右键** → 通过 Native Messaging → `handleSavePage()` → `importFromHtml()`

**可能原因**：
- 浏览器扩展的 Native Messaging 配置问题：
  - `host.bat` 中路径是占位符 `C:\path\to\knowledge-base.exe`，需要替换为实际路径
  - `com.knowledgebase.host.json` 中 `allowed_origins` 是占位符 `chrome-extension://<extension-id>/`
  - 注册表未注册
- Windows 资源管理器右键：没有注册表项来关联右键菜单

**修复方案**：
1. 在应用启动时自动检测并注册 Native Messaging Host（生成正确的 host.bat、json、注册表项）
2. 添加 Windows 资源管理器右键菜单注册功能
3. 在 SettingsView 中添加"集成设置"区域，让用户可以一键注册/卸载

---

## 详细实施步骤

### Step 1：修复 Markdown 文件预览和编辑

**修改 `src/renderer/src/views/ItemDetailView.tsx`**：

1. 添加辅助函数判断是否为 Markdown 文件：
```typescript
const isMarkdownFile = item && (
  item.mime_type === 'text/markdown' ||
  (item.source_name && item.source_name.endsWith('.md'))
);
```

2. 修改预览逻辑，Markdown 文件使用 TipTap 只读模式：
- 当 `isMarkdownFile` 且有 `content_html` → TipTap 只读
- 当 `isMarkdownFile` 且只有 `content` → ReactMarkdown 渲染
- 当 `isMarkdownFile` 且无内容 → 显示"空白文档，点击编辑开始"

3. 编辑模式：Markdown 文件也使用 TipTap 编辑器（已有逻辑，无需修改）

4. 保存时同步 .md 文件：添加 `file:writeFileContent` IPC，保存时如果是 Markdown 文件且有 `file_path`，同时将内容写入磁盘文件

**新增后端 IPC**：
- `src/main/ipc/file.ipc.ts`：添加 `file:writeFileContent` IPC
- `src/preload/index.ts`：添加 `writeFileContent` API

### Step 2：Excel 预览支持筛选

**重写 `src/renderer/src/components/preview/ExcelPreview.tsx`**：

1. 使用 `exceljs` 替代 `xlsx-preview` 读取数据（后端读取，前端展示）
2. 添加后端 IPC `file:readExcelData`：读取 Excel 文件，返回结构化数据：
```typescript
interface ExcelData {
  sheets: Array<{
    name: string;
    headers: string[];
    rows: string[][];
  }>;
}
```
3. 前端渲染为 HTML 表格，每列表头添加筛选图标
4. 筛选逻辑：
   - 点击筛选图标 → 弹出下拉面板
   - 显示该列所有唯一值（带复选框）
   - 搜索框快速筛选值
   - 全选/取消全选
   - 确认后过滤表格行
5. 保留多 Sheet 切换

**新增后端**：
- `src/main/ipc/file.ipc.ts`：添加 `file:readExcelData` IPC
- `src/main/services/office-template.ts`：添加 `readExcelData()` 方法
- `src/preload/index.ts`：添加 `readExcelData` API

### Step 3：右键菜单修复 - 自动注册 Native Messaging

**修改 `src/main/index.ts`**：

1. 在 `initializeApp()` 中，应用启动后自动检测 Native Messaging 注册状态
2. 如果未注册，自动执行注册流程：
   - 获取当前 exe 路径
   - 生成 `host.bat`（指向当前 exe）
   - 生成 `com.knowledgebase.host.json`（需要扩展 ID）
   - 写入注册表

**新建 `src/main/services/integration.ts`**：
- `registerNativeMessaging(extensionId?: string)`：注册 Native Messaging Host
- `unregisterNativeMessaging()`：取消注册
- `isNativeMessagingRegistered()`：检查是否已注册
- `registerContextMenu()`：注册 Windows 资源管理器右键菜单
- `unregisterContextMenu()`：取消注册右键菜单

**修改 `src/renderer/src/views/SettingsView.tsx`**：
- 添加"外部集成"设置区域
- 显示 Native Messaging 注册状态
- 一键注册/卸载按钮
- 输入 Chrome 扩展 ID
- 显示 Windows 右键菜单注册状态
- 一键注册/卸载右键菜单

**新增 IPC**：
- `integration:registerNativeMessaging`
- `integration:unregisterNativeMessaging`
- `integration:isNativeMessagingRegistered`
- `integration:registerContextMenu`
- `integration:unregisterContextMenu`

### Step 4：构建验证

- `npm run build` 确保编译通过

---

## 涉及文件汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/renderer/src/views/ItemDetailView.tsx` | 修改 | Markdown 文件预览/编辑逻辑修复 |
| `src/renderer/src/components/preview/ExcelPreview.tsx` | 重写 | 支持筛选的 Excel 预览 |
| `src/main/ipc/file.ipc.ts` | 修改 | 添加 writeFileContent、readExcelData IPC |
| `src/main/services/office-template.ts` | 修改 | 添加 readExcelData、writeFileContent 方法 |
| `src/main/services/integration.ts` | 新建 | Native Messaging + 右键菜单注册 |
| `src/main/ipc/integration.ipc.ts` | 新建 | 集成相关 IPC handler |
| `src/main/index.ts` | 修改 | 启动时自动检测注册状态 |
| `src/main/ipc/index.ts` | 修改 | 注册 integration IPC |
| `src/preload/index.ts` | 修改 | 添加新 API |
| `src/renderer/src/lib/api.ts` | 修改 | 添加新方法 |
| `src/renderer/src/views/SettingsView.tsx` | 修改 | 添加外部集成设置区域 |
