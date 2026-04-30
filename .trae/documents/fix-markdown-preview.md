# 修复 Markdown 预览和分屏对比功能

## 问题分析

### 问题：Markdown 不支持预览和对比了

**根因**：查看模式下，Markdown 文件的预览逻辑有优先级问题。

当前代码（第 744-767 行）：

```tsx
// 条件1：isMarkdownFile && item.content_html → 用 TipTap 只读模式
// 条件2：isMarkdownFile && !item.content_html && item.content → 用 ReactMarkdown
// 条件3：isMarkdownFile && !item.content_html && !item.content → 空白提示
```

**问题1**：当 Markdown 文件同时有 `content`（MD 原文）和 `content_html`（HTML）时，条件1 先匹配，用 TipTap 只读模式渲染 HTML，而不是用 ReactMarkdown 渲染 Markdown 原文。这导致 Markdown 预览失效。

**问题2**：对于新建的 Markdown 笔记（`contentType: 'note'`, `mimeType: 'text/markdown'`），保存时 `handleSave` 中 `isMarkdownFile` 为 true，走 `updateData.content = editContent` 分支，但**没有同时设置 `contentHtml`**。然而如果之前用 TipTap 编辑过，数据库中可能残留 `content_html`。需要确保 MD 文件查看时始终用 ReactMarkdown 渲染 `content` 字段。

**问题3**：编辑模式下的分屏预览逻辑（第 547-579 行）本身是正确的，但 `isMarkdownFile` 的判断依赖 `item.mime_type`，而某些旧数据可能没有设置 `mime_type`。

## 修复方案

### 修改 ItemDetailView.tsx 查看模式下的 Markdown 预览逻辑

将 Markdown 文件的查看逻辑简化为：**始终用 ReactMarkdown 渲染 `item.content`（MD 原文）**，不再用 TipTap 只读模式渲染 `content_html`。

```tsx
// 修改前（3 个条件，优先用 TipTap 渲染 HTML）
{isMarkdownFile && item.content_html && (<TipTapEditor .../>)}
{isMarkdownFile && !item.content_html && item.content && (<ReactMarkdown .../>)}
{isMarkdownFile && !item.content_html && !item.content && (空白提示)}

// 修改后（1 个条件，始终用 ReactMarkdown 渲染 MD 原文）
{isMarkdownFile && item.content && (<ReactMarkdown>{item.content}</ReactMarkdown>)}
{isMarkdownFile && !item.content && (空白提示)}
```

这样 Markdown 文件查看时始终显示渲染后的 Markdown，编辑时使用 textarea + ReactMarkdown 分屏对比。

## 实施步骤

### Step 1: 修改 ItemDetailView.tsx 查看 Markdown 预览逻辑

将第 744-767 行的 3 个条件合并为 2 个：
- `isMarkdownFile && item.content` → ReactMarkdown 渲染
- `isMarkdownFile && !item.content` → 空白提示

### Step 2: 构建验证

运行 `npm run build` 确认无编译错误。
