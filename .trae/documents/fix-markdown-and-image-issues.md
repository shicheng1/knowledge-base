# 修复计划：4 个 Markdown/内容相关问题

## 问题 1：Markdown 预览中标题没有不同大小

### 根因分析
MarkdownEditor 的预览区域使用了 `prose prose-sm` Tailwind 类，其中 `prose-sm` 会覆盖标题的字体大小，使所有标题看起来差不多大。`prose-sm` 是 Tailwind Typography 的小号排版预设，它将 h1-h6 的字体大小差异缩小到几乎不可见。

### 修复方案
- 在 `globals.css` 中为 `.md-preview-content` 内的 h1-h6 添加明确的字体大小样式，覆盖 `prose-sm` 的默认值
- 确保标题层级有明显的视觉区分（大小、粗细、颜色）

### 涉及文件
- `src/renderer/src/styles/globals.css` — 添加 `.md-preview-content h1` ~ `h6` 样式

---

## 问题 2：Markdown 编辑器图片上传功能修复

### 根因分析
MarkdownEditor.tsx 中完全没有实现图片拖放和粘贴功能。当前只有 MarkdownToolbar 的图片按钮，它只是插入 `![图片描述](url)` 文本语法，没有实际的图片上传逻辑。

TipTapEditor 中已有完整的图片处理实现（拖放、粘贴、选择文件），但 MarkdownEditor 没有移植这些功能。

### 修复方案
1. **图片拖放**：在 MarkdownEditor 的 CodeMirror 中添加 `handleDrop` 处理，将图片保存到本地并在编辑器中插入 `![](file://...)` Markdown 语法
2. **图片粘贴**：添加 `handlePaste` 处理，检测剪贴板中的图片数据
3. **图片选择按钮**：修改 MarkdownToolbar 的图片按钮，调用 `window.api.editor.selectImage(itemId)` 打开文件选择对话框，选择后插入本地路径

### 涉及文件
- `src/renderer/src/components/editor/MarkdownEditor.tsx` — 添加图片拖放/粘贴/选择功能
- `src/renderer/src/components/editor/MarkdownToolbar.tsx` — 修改图片按钮逻辑

---

## 问题 3：全部条目列表中显示了标签

### 根因分析
经过代码审查，HomeView、FolderView、SearchView 的 Item 接口均**不包含 tags 字段**，列表卡片中也没有渲染标签。用户可能指的是详情页预览中显示了标签信息，或者用户希望列表中**不显示**标签但当前显示了。

需要和用户确认：是"列表中不应该显示标签但显示了"，还是"列表中应该显示标签但没有显示"。

根据用户原话"全部条目的预览显示出了标签"，推测用户认为标签不应该在列表预览中显示，或者标签显示方式有问题。

查看 ItemDetailView.tsx 第 548-563 行，非编辑模式下确实显示了标签。这可能是用户不想要的——在预览/阅读模式下标签占据了空间。

**暂定方案**：保持详情页标签显示不变（这是正常的元信息展示），但需要确认用户具体指的是哪个视图。

---

## 问题 4：网页复制公众号文章图片看不了

### 根因分析
微信公众号文章的图片使用了 `data-src` 属性（懒加载），而非标准的 `src`。当前处理流程：

1. **浏览器扩展保存**（native-messaging.ts）：仅当 `isWechat === true` 时才下载图片并替换路径。但存在一个问题：
   - 替换正则 `(data-src|src)\s*=\s*["']${escapedSrc}["']` 只替换了属性值，没有把 `data-src` 改成 `src`
   - 微信图片原始 HTML 是 `<img data-src="xxx" src="placeholder">`，替换后变成 `<img data-src="本地路径" src="placeholder">`
   - 浏览器渲染时优先读 `src`，而 `src` 仍然是占位图，所以图片显示不出来

2. **URL 导入**（import-service.ts → content-extractor.ts）：Readability 提取 HTML 时，微信图片的 `data-src` 不会被识别为图片源，图片可能丢失或保留为占位符

### 修复方案
1. **修复微信图片替换逻辑**：在 `native-messaging.ts` 中，替换时不仅替换属性值，还要将 `data-src` 属性名改为 `src`，确保浏览器能正确加载
2. **修复 content-extractor.ts**：在 HTML 提取前，预处理微信文章的 `data-src` → `src` 转换
3. **修复图片本地路径引用**：确保本地路径使用 `file://` 协议，这样在 Electron 的 webview 中才能正确加载

### 涉及文件
- `src/main/services/native-messaging.ts` — 修复微信图片替换逻辑
- `src/main/services/content-extractor.ts` — 预处理 data-src → src 转换
- `src/main/services/image-downloader.ts` — 确保返回 `file://` 路径

---

## 实施步骤

1. 修复 Markdown 预览标题样式（globals.css）
2. 为 MarkdownEditor 添加图片拖放/粘贴/选择功能（MarkdownEditor.tsx + MarkdownToolbar.tsx）
3. 确认问题 3 的具体需求并修复
4. 修复微信文章图片显示问题（native-messaging.ts + content-extractor.ts）
5. 构建验证
