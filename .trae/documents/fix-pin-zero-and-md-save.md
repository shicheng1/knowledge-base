# Bug 修复 + 需求文档计划

## 问题分析

### Bug 1: 文件标题前显示 "0"

**根因**: MySQL 返回 `is_pinned` 字段为 TINYINT 类型（值为 `0` 或 `1`），而非 JavaScript 的 boolean。在 React JSX 中，`{item.is_pinned && <Pin />}` 当 `is_pinned` 为 `0` 时，表达式求值结果为 `0`，React 会将 `0` 渲染为文本 "0"。这是经典的 React 陷阱。

**影响文件**:
- `src/renderer/src/views/ItemDetailView.tsx` - 第 579 行 `{item.is_pinned && <Pin .../>}`
- `src/renderer/src/views/HomeView.tsx` - 第 614 行 `{item.is_pinned && <Pin .../>}`
- `src/renderer/src/views/FolderView.tsx` - 第 624 行 `{item.is_pinned && <Pin .../>}`

**修复方案**: 所有 `item.is_pinned &&` 改为 `!!item.is_pinned &&`，双取反将 `0` 转为 `false`，避免渲染数字。

### Bug 2: 新增 Markdown 类型文件但保存不是 Markdown 文件

**根因**: 创建 "Markdown 笔记"（type === 'note'）时，没有设置 `mimeType: 'text/markdown'`。打开编辑时，`isMarkdownFile` 检测条件为 `item.mime_type === 'text/markdown' || (item.source_name && item.source_name.endsWith('.md'))`，由于没有 mimeType 也没有 .md 后缀的 sourceName，所以 `isMarkdownFile` 为 false，导致使用 TipTap 富文本编辑器而非 Markdown 编辑器。保存时内容以 HTML 格式存入，而非 Markdown 原文。

**影响文件**:
- `src/renderer/src/views/HomeView.tsx` - `handleCreateFile` 中 type === 'note' 分支缺少 `mimeType: 'text/markdown'`
- `src/renderer/src/views/FolderView.tsx` - 同样的问题

**修复方案**: 在 "Markdown 笔记" 创建代码中添加 `mimeType: 'text/markdown'`。

### 需求 3: 生成需求文档并记录迭代信息

在项目根目录创建 `docs/requirements.md`，包含：
- 项目概述
- 功能需求列表（按模块分类）
- 每次迭代的变更记录

---

## 实施步骤

### Step 1: 修复标题前显示 "0" 的 bug

在以下 3 个文件中，将所有 `item.is_pinned &&` 改为 `!!item.is_pinned &&`：

1. `src/renderer/src/views/ItemDetailView.tsx`
   - 标题区域的 `{item.is_pinned && <Pin .../>}`
2. `src/renderer/src/views/HomeView.tsx`
   - 列表卡片标题行的 `{item.is_pinned && <Pin .../>}`
3. `src/renderer/src/views/FolderView.tsx`
   - 列表卡片标题行的 `{item.is_pinned && <Pin .../>}`

### Step 2: 修复 Markdown 笔记保存问题

1. `src/renderer/src/views/HomeView.tsx` - `handleCreateFile` 的 type === 'note' 分支添加 `mimeType: 'text/markdown'`
2. `src/renderer/src/views/FolderView.tsx` - 同样修改

### Step 3: 生成需求文档

创建 `docs/requirements.md`，内容包含：
- 项目概述（技术栈、架构）
- 功能模块清单（条目管理、文件夹、标签、搜索、编辑器、预览、导入导出、回收站、置顶收藏、浏览器扩展集成、设置）
- 迭代记录（从 v1.0 到当前的所有功能迭代历史）

### Step 4: 构建验证

运行 `npm run build` 确认无编译错误。
