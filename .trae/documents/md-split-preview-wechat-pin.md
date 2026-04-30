# Markdown 分屏预览 + 微信文章保存 + 置顶功能

## 实施步骤

### Step 1: Markdown 编辑分屏预览
- ItemDetailView 编辑模式下，Markdown 文件改为左右分屏：左侧 textarea 编辑，右侧 ReactMarkdown 实时预览
- 添加分屏切换按钮（仅编辑/仅预览/分屏）

### Step 2: 微信公众号文章保存
- 增强浏览器扩展 content.js：检测微信公众号页面，提取文章正文（#js_content 区域）、作者、发布时间
- 增强 import-service.ts：微信文章保存时下载内联图片到本地存储，替换 HTML 中的图片 URL
- 添加 `file:downloadImages` IPC：批量下载 HTML 中的图片

### Step 3: 文件置顶
- 数据库迁移 004：items 表添加 `is_pinned TINYINT(1) DEFAULT 0` + 索引
- 后端：item.repo.ts 查询默认按 is_pinned DESC 排序，添加 togglePin 方法
- IPC：item:togglePin
- 前端：ItemDetailView 添加置顶按钮，HomeView/FolderView 列表中置顶条目显示置顶图标
