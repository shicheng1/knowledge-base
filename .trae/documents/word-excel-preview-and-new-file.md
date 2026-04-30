# Word/Excel 预览编辑 + 新建文件功能 实施计划

## 需求分析

### 需求 1：Word 和 Excel 支持预览和修改

当前状态：Word/Excel 文件只能"用外部程序打开"，无法在应用内预览。

**技术方案选型**：

| 方案                              | Word 预览   | Word 编辑 | Excel 预览  | Excel 编辑 | 复杂度       |
| ------------------------------- | --------- | ------- | --------- | -------- | --------- |
| **docx-preview + xlsx-preview** | ✅ 高保真渲染   | ❌ 只读    | ✅ HTML 表格 | ❌ 只读     | 中         |
| **docx-preview + Luckysheet**   | ✅ 高保真渲染   | ❌ 只读    | ✅ 完整表格    | ✅ 可编辑    | 高         |
| **mammoth + SheetJS**           | ✅ 语义 HTML | ❌ 只读    | ✅ HTML 表格 | ❌ 只读     | 中         |
| **OnlyOffice/Collabora**        | ✅ 完整      | ✅ 完整    | ✅ 完整      | ✅ 完整     | 极高（需部署服务） |

**推荐方案**：采用 **docx-preview + xlsx-preview** 实现预览，编辑通过 TipTap 编辑器（Word 内容提取后编辑）+ 调用系统 Office 打开编辑（Excel）。

具体策略：

* **Word (.docx)**：使用 `docx-preview` 高保真渲染预览；编辑时提供两种模式：

  1. "在线编辑"：用 mammoth 提取内容为 HTML，在 TipTap 编辑器中编辑（适合简单文档）
  2. "用 Office 编辑"：调用系统 WPS/Office 打开原文件编辑

* **Excel (.xlsx)**：使用 `xlsx-preview` 渲染为 HTML 表格预览；编辑调用系统 Office 打开

* **Word (.doc)**：旧格式不支持前端渲染，只能用 Office 打开

### 需求 2：新建文件功能（Word/Excel/Markdown）

当前状态：无新建文件入口。

**方案**：

* 在 HomeView 和 FolderView 的顶部操作栏添加"新建"下拉按钮
* 新建 Markdown 笔记：直接创建 `contentType: 'note'` 的条目，打开 TipTap 编辑器
* 新建 Markdown 文件：在存储目录创建空白 .md 文件，创建条目关联该文件，用 TipTap 编辑器编辑
* 新建 Word：在存储目录创建空白 .docx 文件，创建条目关联该文件
* 新建 Excel：在存储目录创建空白 .xlsx 文件，创建条目关联该文件

***

## 详细实施步骤

### Step 1：安装依赖

```
npm install docx-preview xlsx-preview mammoth exceljs docx
```

* `docx-preview`：Word 文档高保真 HTML 渲染
* `xlsx-preview`：Excel 文件转 HTML 表格
* `mammoth`：Word 文档转语义 HTML（用于编辑模式提取内容）
* `exceljs`：创建空白 Excel 文件 + 读取 Excel 数据
* `docx`：创建空白 Word 文件

### Step 2：后端 - 新增文件读取 IPC

**修改** **`src/main/ipc/file.ipc.ts`**：

* 新增 `file:readFileAsBuffer` IPC：读取文件返回 ArrayBuffer（供前端 docx-preview/xlsx-preview 使用）
* 新增 `file:createEmptyDocx` IPC：在存储目录创建空白 .docx 文件
* 新增 `file:createEmptyXlsx` IPC：在存储目录创建空白 .xlsx 文件
* 新增 `file:createEmptyMd` IPC：在存储目录创建空白 .md 文件

**修改** **`src/main/services/file-manager.ts`** **或新建** **`src/main/services/office-template.ts`**：

* `createEmptyDocx(folderPath, fileName)`：使用 `docx` npm 包生成空白 .docx
* `createEmptyXlsx(folderPath, fileName)`：使用 `exceljs` 生成空白 .xlsx
* `createEmptyMd(folderPath, fileName)`：创建空白 .md 文件

### Step 3：后端 - 修改 item:create 支持文件关联

**修改** **`src/main/database/repositories/item.repo.ts`**：

* `create()` 已支持 `filePath`、`mimeType`、`contentType` 等字段，无需修改

### Step 4：前端 - Word 预览组件

**新建** **`src/renderer/src/components/preview/WordPreview.tsx`**：

* 接收 `filePath: string` prop

* 通过 `window.api.file.readFileAsBuffer(filePath)` 获取文件 ArrayBuffer

* 使用 `docx-preview` 的 `renderAsync` 渲染到容器

* 加载状态 + 错误处理

* 提供"用 Office 编辑"按钮

### Step 5：前端 - Excel 预览组件

**新建** **`src/renderer/src/components/preview/ExcelPreview.tsx`**：

* 接收 `filePath: string` prop

* 通过 `window.api.file.readFileAsBuffer(filePath)` 获取文件 ArrayBuffer

* 使用 `xlsx-preview` 的 `xlsx2Html` 转换为 HTML

* 渲染到容器，支持多 Sheet 切换

* 提供"用 Office 编辑"按钮

### Step 6：前端 - 修改 ItemDetailView\.tsx 集成预览

**修改** **`src/renderer/src/views/ItemDetailView.tsx`**：

* 替换当前 Word/Excel 的"不支持预览"占位符：

  * `.docx` 文件 → 使用 `WordPreview` 组件

  * `.xlsx` 文件 → 使用 `ExcelPreview` 组件

  * `.doc` / `.xls` 旧格式 → 保留"用 Office 打开"按钮

* 编辑模式：

  * Word 类型：提供"在线编辑"按钮，点击后用 mammoth 提取 HTML → TipTap 编辑

  * Excel 类型：只提供"用 Office 编辑"按钮（表格编辑太复杂，不适合 TipTap）

### Step 7：前端 - 新建文件功能

**修改** **`src/renderer/src/views/HomeView.tsx`**：

* 顶部操作栏添加"新建"下拉按钮（Plus 图标），选项：
  * 新建 Markdown 笔记
  * 新建 Markdown 文件
  * 新建 Word 文档
  * 新建 Excel 表格

* 新建 Markdown 笔记：调用 `window.api.item.create({ title: '未命名笔记', contentType: 'note', sourceType: 'manual' })`，创建后跳转到条目详情页编辑模式

* 新建 Markdown 文件：调用 `window.api.file.createEmptyMd()` → `window.api.item.create({ title: '未命名文件', contentType: 'note', filePath, mimeType: 'text/markdown', sourceName: 'xxx.md', sourceType: 'manual' })`，创建后跳转详情页进入编辑模式

* 新建 Word：调用 `window.api.file.createEmptyDocx()` → `window.api.item.create({ title: '未命名文档', contentType: 'file', filePath, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sourceType: 'manual' })`，创建后跳转详情页

* 新建 Excel：类似 Word，用 `createEmptyXlsx`

**修改** **`src/renderer/src/views/FolderView.tsx`**：

* 同 HomeView，添加"新建"下拉按钮

* 新建时自动关联当前文件夹 `folderId`

### Step 8：更新 preload 和 api

**修改** **`src/preload/index.ts`**：

* 添加 `readFileAsBuffer`、`createEmptyDocx`、`createEmptyXlsx`、`createEmptyMd`

**修改** **`src/renderer/src/lib/api.ts`**：

* 添加对应方法

### Step 9：样式优化

**修改** **`src/renderer/src/styles/globals.css`**：

* 添加 docx-preview 渲染样式覆盖

* 添加 xlsx-preview 表格样式

### Step 10：构建验证

* `npm run build` 确保编译通过

* 测试 Word/Excel 预览

* 测试新建文件流程

***

## 涉及文件汇总

| 文件                                                     | 操作 | 说明                                                       |
| ------------------------------------------------------ | -- | -------------------------------------------------------- |
| `package.json`                                         | 修改 | 添加 docx-preview, xlsx-preview, mammoth, exceljs, docx 依赖 |
| `src/main/ipc/file.ipc.ts`                             | 修改 | 添加 readFileAsBuffer, createEmptyDocx, createEmptyXlsx, createEmptyMd |
| `src/main/services/office-template.ts`                 | 新建 | 生成空白 Word/Excel/Markdown 文件 |
| `src/preload/index.ts`                                 | 修改 | 添加新 API                                                  |
| `src/renderer/src/lib/api.ts`                          | 修改 | 添加新方法                                                    |
| `src/renderer/src/components/preview/WordPreview.tsx`  | 新建 | Word 预览组件                                                |
| `src/renderer/src/components/preview/ExcelPreview.tsx` | 新建 | Excel 预览组件                                               |
| `src/renderer/src/views/ItemDetailView.tsx`            | 修改 | 集成 Word/Excel 预览 + 编辑入口                                  |
| `src/renderer/src/views/HomeView.tsx`                  | 修改 | 添加新建文件按钮                                                 |
| `src/renderer/src/views/FolderView.tsx`                | 修改 | 添加新建文件按钮                                                 |
| `src/renderer/src/styles/globals.css`                  | 修改 | 预览样式                                                     |

***

## 限制说明

1. **Word 编辑**：在线编辑（TipTap）仅适合简单文本内容，复杂排版（表格、图片、页眉页脚）会丢失格式。完整编辑需调用系统 Office。
2. **Excel 编辑**：前端无法实现真正的表格编辑体验（公式、图表、条件格式等），编辑需调用系统 Office。
3. **旧格式**：`.doc` 和 `.xls` 不支持前端预览，只能用 Office 打开。
4. **文件同步**：用 Office 编辑后，知识库中的预览不会自动刷新，需手动刷新页面。

