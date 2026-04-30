# Markdown 预览格式修复 + 新建文件保存修复

## 问题根因分析

### 问题 1：Markdown 文件预览不是 Markdown 格式

**根因**：TipTap 是富文本编辑器，输出的是 **HTML**，不是 Markdown。当用户用 TipTap 编辑 Markdown 文件并保存时：
- `editContent` 是 HTML 格式（如 `<p>Hello</p>`）
- 保存到数据库 `content` 字段的是 HTML
- 查看时，`content_html` 为 null，`content` 为 HTML
- 代码走 `ReactMarkdown` 渲染 `content`，但 `content` 是 HTML 不是 Markdown
- 结果：HTML 标签被当作纯文本显示

**修复方案**：Markdown 文件编辑时使用 **textarea**（原生 Markdown 编辑器），不用 TipTap。这样：
- 编辑时直接编辑 Markdown 原文
- 保存时 `content` 字段存 Markdown 文本
- 查看时用 ReactMarkdown 正确渲染

### 问题 2：新建文件不能保存

**根因**：`handleSave` 中发送 `folder_id: editFolderId`（snake_case），但后端 `UpdateItemDTO` 期望 `folderId`（camelCase）。`update` 方法检查 `data.folderId !== undefined`，收到的是 `data.folder_id`，所以 `folderId` 始终是 `undefined`，文件夹信息不会被更新。

**修复方案**：将 `folder_id` 改为 `folderId`。

---

## 详细实施步骤

### Step 1：修复 Markdown 文件编辑 - 使用 textarea 替代 TipTap

**修改 `src/renderer/src/views/ItemDetailView.tsx`**：

1. 编辑模式下，Markdown 文件使用 `<textarea>` 而非 TipTap：
```tsx
{isMarkdownFile ? (
  <textarea
    value={editContent}
    onChange={(e) => setEditContent(e.target.value)}
    className="w-full min-h-[400px] rounded-lg border border-gray-300 p-4 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    placeholder="输入 Markdown 内容..."
  />
) : (
  <TipTapEditor content={editContent} onChange={(html) => setEditContent(html)} />
)}
```

2. 初始化 `editContent` 时，Markdown 文件取 `data.content`（Markdown 原文），而非 `data.content_html`（HTML）：
```tsx
setEditContent(isMarkdownFile ? (data.content || '') : (data.content_html || data.content || ''));
```

3. 保存时，Markdown 文件保存 Markdown 文本到 `content`，非 Markdown 文件保存 HTML 到 `contentHtml`：
```tsx
const updateData: any = {
  title: editTitle,
  folderId: editFolderId,  // 修复 snake_case 问题
};
if (isMarkdownFile) {
  updateData.content = editContent;  // Markdown 文本
} else {
  updateData.content = editContent;  // HTML
  updateData.contentHtml = editContent;  // 同时更新 contentHtml
}
```

### Step 2：修复保存时字段名 snake_case → camelCase

**修改 `src/renderer/src/views/ItemDetailView.tsx`**：

`handleSave` 中 `folder_id: editFolderId` → `folderId: editFolderId`

### Step 3：构建验证

- `npm run build` 确保编译通过
