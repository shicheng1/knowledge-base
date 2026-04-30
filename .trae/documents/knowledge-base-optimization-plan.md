# 知识库项目优化计划

## 问题诊断

经过全面代码审查，发现以下核心问题：

### 1. 拖拽导入完全失效
- **根因**：`webContents.on('drop')` 在 Electron 中配合 `will-navigate` 拦截时行为不可靠，事件经常不触发
- **渲染进程**：HomeView 的 `handleDropEvent` 只做了 `preventDefault()` + 重置状态，没有实际导入逻辑
- **FolderView**：依赖 `file.path` 属性（Electron 安全限制下为空字符串），且调用了未注册的 `file:importByDrag` IPC 通道

### 2. 右键菜单导入问题
- `handleSaveFile` 中对 `.txt/.md/.csv` 读取内容时未处理编码问题
- 对 `.html/.htm` 文件没有提取内容，只复制了文件
- 文件复制到存储目录时，如果存储目录在 C 盘可能有权限问题

### 3. 文件预览问题
- 图片类型无内联预览（只显示"打开文件"按钮）
- `contentHtml` 字段存储了 HTML 但完全未使用
- ReactMarkdown 未配置 `remark-gfm` 和 `rehype-highlight` 插件
- 代码类型无语法高亮

### 4. 分类管理不完善
- 侧边栏无法创建/删除/重命名文件夹
- 无法在首页直接创建文件夹
- 标签只能在编辑条目时选择，无法独立管理

### 5. Windows C 盘权限问题
- 默认存储路径 `app.getPath('userData')` 在 C 盘 `AppData` 下
- 复制文件到 C 盘目录可能因 UAC 权限失败

---

## 优化方案

### 第一阶段：修复拖拽导入（核心功能）

**方案**：完全重写拖拽架构，采用「渲染进程读取 + IPC 传输」模式

1. **渲染进程**（HomeView/FolderView）：
   - `onDrop` 时使用 `File.text()` 读取文本文件内容
   - 使用 `File.arrayBuffer()` 读取二进制文件
   - 通过 IPC 将文件信息（名称、内容、类型）传给主进程

2. **主进程**（file.ipc.ts）：
   - 注册 `file:importByDrag` IPC handler（当前缺失！）
   - 文本文件：直接存储内容到数据库
   - 二进制文件：将内容写入存储目录，记录路径

3. **移除** `window.ts` 中的 `setupDragDropHandler`（不可靠）

4. **修复** `will-navigate` 只阻止外部 file:// 导航，不阻止应用内部路由

### 第二阶段：修复右键菜单导入

1. **修复 `handleSaveFile`**：
   - 对 `.html/.htm` 文件使用 `extractFromHtml` 提取内容
   - 添加文件编码检测（使用 `jschardet` 或 BOM 检测）
   - 存储目录不存在时自动创建

2. **修复存储路径权限**：
   - 默认存储路径改为非 C 盘（如 `D:\KnowledgeBase`）
   - 如果 C 盘写入失败，自动回退到用户文档目录

### 第三阶段：文件预览增强

1. **图片预览**：`content_type === 'image'` 时显示 `<img>` 标签
2. **HTML 预览**：使用 `contentHtml` 字段，通过 `iframe` 或 `dangerouslySetInnerHTML` 渲染
3. **代码高亮**：ReactMarkdown 配置 `remark-gfm` + `rehype-highlight`
4. **PDF 预览**：使用 `<iframe>` 或 `<embed>` 加载 PDF 文件
5. **Office 文件**：显示文件信息 + "打开文件"按钮（无法内联预览）

### 第四阶段：分类管理增强

1. **侧边栏文件夹管理**：
   - 添加"新建文件夹"按钮
   - 右键菜单支持重命名/删除文件夹
   - 拖拽排序（后续迭代）

2. **标签管理**：
   - 侧边栏标签区域添加"新建标签"按钮
   - 点击标签可编辑/删除

3. **首页文件夹创建**：
   - 添加"新建文件夹"入口

### 第五阶段：更多文件类型支持

1. **扩展导入类型映射**：
   - 代码文件：`.js/.ts/.py/.java/.c/.cpp/.go/.rs/.sh/.bat/.ps1` → `code` 类型
   - 视频文件：`.mp4/.avi/.mkv/.mov` → `video` 类型（新增 ContentType）
   - 音频文件：`.mp3/.wav/.flac/.ogg` → `audio` 类型（新增 ContentType）

2. **代码文件处理**：
   - 读取内容存入 `content` 字段
   - 预览时使用语法高亮

---

## 实施步骤

### Step 1: 修复拖拽导入
- 修改 `window.ts`：移除 `setupDragDropHandler`，修复 `will-navigate`
- 修改 `HomeView.tsx`：实现完整的拖拽导入逻辑
- 修改 `FolderView.tsx`：实现完整的拖拽导入逻辑
- 修改 `file.ipc.ts`：注册 `file:importByDrag` IPC handler
- 修改 `preload/index.ts`：确保 API 正确暴露

### Step 2: 修复右键菜单导入
- 修改 `index.ts`：修复 `handleSaveFile` 函数
- 修改 `config.ts`：默认存储路径改为非 C 盘

### Step 3: 文件预览增强
- 修改 `ItemDetailView.tsx`：根据内容类型显示不同预览
- 添加 `remark-gfm` + `rehype-highlight` 插件配置
- 图片类型显示 `<img>` 标签
- PDF 使用 `<iframe>` 预览

### Step 4: 分类管理增强
- 修改 `Sidebar.tsx`：添加文件夹/标签管理功能
- 修改 `HomeView.tsx`：添加新建文件夹入口

### Step 5: 扩展文件类型支持
- 修改 `import-service.ts`：扩展文件类型映射
- 修改数据库迁移：添加 `video`/`audio` ContentType
- 修改前端类型映射

---

## 涉及的关键文件

| 文件 | 修改内容 |
|------|---------|
| `src/main/window.ts` | 移除拖拽处理，修复 will-navigate |
| `src/main/ipc/file.ipc.ts` | 注册 importByDrag，修复 importFilesByContent |
| `src/main/index.ts` | 修复 handleSaveFile |
| `src/main/services/import-service.ts` | 扩展文件类型，修复编码 |
| `src/main/utils/config.ts` | 默认存储路径改为非 C 盘 |
| `src/main/database/types.ts` | 可能需要扩展 ContentType |
| `src/renderer/src/views/HomeView.tsx` | 实现拖拽导入逻辑 |
| `src/renderer/src/views/FolderView.tsx` | 实现拖拽导入逻辑 |
| `src/renderer/src/views/ItemDetailView.tsx` | 文件预览增强 |
| `src/renderer/src/components/layout/Sidebar.tsx` | 文件夹/标签管理 |
| `src/preload/index.ts` | API 暴露调整 |
