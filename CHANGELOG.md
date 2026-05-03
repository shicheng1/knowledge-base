# 迭代版本日志

## v2.2.0 (2026-04-30)

### 新增功能（不接入 AI 的优先级 1-5 功能）

- **Markdown 编辑器增强** — 新增 KaTeX 数学公式渲染（`$...$`/`$$...$$`）、Mermaid 图表渲染（` ```mermaid ` 代码块）、编辑/预览双向同步滚动、底部字数/字符/阅读时长统计栏。
- **大纲面板（Outline）** — 编辑 Markdown 时右侧实时显示标题层级大纲，点击跳转到对应行号。
- **命令面板（Command Palette）** — 全局快捷键 `Ctrl+P` 跳转条目（标题模糊搜索），`Ctrl+Shift+P` 调用命令（新建笔记/前往各视图/注册右键菜单等），支持上下键选择、回车确认、Esc 关闭。
- **知识图谱视图（Graph）** — 基于 vis-network 渲染条目节点 + `item_links` 边，支持按内容类型着色、按入链度数调整大小、关键词过滤、隐藏孤立节点、双击跳转条目详情。
- **每日笔记（Daily Note）** — `/daily/:date?` 路由，按日期自动获取或创建当日笔记（标题为 YYYY-MM-DD），支持前一天/后一天/今天快速翻页，复用 Markdown 编辑器。
- **TODO 聚合（Todos）** — 全库扫描 `- [ ]` / `- [x]` 行，按条目分组展示。复选框点击直接更新原条目内容并切换状态，支持待办/已完成/全部三种过滤。
- **WebDAV 备份/恢复** — 设置页新增 WebDAV 配置卡片，支持坚果云、Nextcloud 等 WebDAV 服务。一键将整库导出为 ZIP（metadata.json + 各条目 .md/.json）上传到远端，支持列出远端备份并下载到本地。
- **Git 同步** — 设置页新增 Git 同步卡片，基于 `isomorphic-git` 实现：将所有条目按文件夹层级写入本地工作目录的 `.md` 文件（含 frontmatter），自动 commit + push 到 GitHub/Gitee/GitLab（HTTPS + PAT）。
- **完整网页存档** — 设置页"完整网页存档"输入 URL，主进程启动隐藏 BrowserWindow 加载页面后注入脚本：内联所有外部 CSS、将图片转为 base64 Data URL、移除所有 `<script>`，生成离线可读的完整 HTML 存为 article 条目。同时暴露 `POST /api/archive` HTTP 接口。
- **Chrome 扩展完整存档模式** — popup 新增"完整存档"复选框，勾选后直接调用桌面端 HTTP `/api/archive` 接口，避免 readability 提取丢失的样式与图片。
- **侧边栏新增导航** — 每日笔记、TODO 聚合、知识图谱三个一级入口。

### 数据库变更

| 迁移               | 内容                                            |
| ------------------ | ----------------------------------------------- |
| 008\_daily\_note   | `items` 表新增 `daily_date` DATE 列与索引       |

### IPC 通道新增

| 通道                          | 说明                                |
| ----------------------------- | ----------------------------------- |
| `item:getGraph`               | 获取整库节点 + 边（图谱用）         |
| `item:getOrCreateDailyNote`   | 获取或创建指定日期的每日笔记        |
| `item:searchTodos`            | 全库扫描含 TODO 复选框的条目        |
| `sync:getStatus`              | 读取 WebDAV/Git 配置 + 上次同步时间 |
| `sync:saveWebdavConfig`       | 保存 WebDAV 配置                    |
| `sync:webdavTest`             | 测试 WebDAV 连接                    |
| `sync:webdavBackup`           | 整库 ZIP 备份到 WebDAV              |
| `sync:webdavList`             | 列出远端 WebDAV 备份                |
| `sync:webdavDownload`         | 下载指定 WebDAV 备份                |
| `sync:saveGitConfig`          | 保存 Git 配置                       |
| `sync:gitPush`                | 写入 + commit + push                |
| `archive:fromUrl`             | 完整网页存档创建条目                |

### HTTP 接口新增

| 路径               | 方法 | 说明                                    |
| ------------------ | ---- | --------------------------------------- |
| `/api/archive`     | POST | Chrome 扩展完整存档模式调用，返回 itemId |

### 文件变更汇总

| 操作 | 文件                                                            |
| ---- | --------------------------------------------------------------- |
| 新增 | `src/renderer/src/components/editor/MermaidBlock.tsx`           |
| 新增 | `src/renderer/src/components/editor/OutlinePanel.tsx`           |
| 新增 | `src/renderer/src/components/global/CommandPalette.tsx`         |
| 新增 | `src/renderer/src/views/GraphView.tsx`                          |
| 新增 | `src/renderer/src/views/DailyNoteView.tsx`                      |
| 新增 | `src/renderer/src/views/TodoView.tsx`                           |
| 新增 | `src/main/services/webdav-sync.service.ts`                      |
| 新增 | `src/main/services/full-archiver.service.ts`                    |
| 新增 | `src/main/ipc/sync.ipc.ts`                                      |
| 新增 | `src/main/ipc/archive.ipc.ts`                                   |
| 修改 | `src/renderer/src/components/editor/MarkdownEditor.tsx` — KaTeX/Mermaid/同步滚动/字数栏/scrollToLine |
| 修改 | `src/renderer/src/components/layout/Layout.tsx` — 接入 CommandPalette |
| 修改 | `src/renderer/src/components/layout/Sidebar.tsx` — 三个新入口    |
| 修改 | `src/renderer/src/views/ItemDetailView.tsx` — 大纲面板          |
| 修改 | `src/renderer/src/views/SettingsView.tsx` — WebDAV/Git/存档卡片 |
| 修改 | `src/renderer/src/App.tsx` — 注册新路由                         |
| 修改 | `src/main/database/repositories/item.repo.ts` — daily/todos 方法 |
| 修改 | `src/main/database/repositories/link.repo.ts` — getGraph        |
| 修改 | `src/main/database/migrations/index.ts` — 008_daily_note        |
| 修改 | `src/main/ipc/item.ipc.ts` — graph/daily/todos 三个 IPC         |
| 修改 | `src/main/ipc/index.ts` — 注册 sync/archive handlers            |
| 修改 | `src/main/integrations/http-server.ts` — `/api/archive` 路由    |
| 修改 | `src/preload/index.ts` — sync/archive/daily/todos/graph 暴露    |
| 修改 | `extension/manifest.json` — host_permissions 加 localhost:17321 |
| 修改 | `extension/popup/popup.html` — 完整存档复选框                   |
| 修改 | `extension/popup/popup.js` — 完整存档分支调用 HTTP /api/archive |

### 依赖变更

| 操作 | 包名                       | 用途                                |
| ---- | -------------------------- | ----------------------------------- |
| 新增 | `remark-math@^6`           | 编辑器预览解析 LaTeX 语法           |
| 新增 | `rehype-katex@^7`          | 编辑器预览渲染 KaTeX                |
| 新增 | `katex@^0.16`              | KaTeX 字体与样式                    |
| 新增 | `mermaid@^11`              | 流程图/时序图渲染                   |
| 新增 | `vis-network@^9` / `vis-data` | 知识图谱可视化                  |
| 新增 | `webdav@^5`                | WebDAV 客户端                       |
| 新增 | `isomorphic-git@^1`        | 纯 JS Git 客户端，免装系统 git      |

***

## v2.3.0 (2026-05-03)

### 新增功能

- **RSS/Atom 订阅源** — 支持订阅外部 RSS/Atom 订阅源，自动解析和同步文章内容。新增 FeedView 页面展示订阅内容列表。
- **内容翻译** — 集成翻译服务，支持将文章内容翻译成中文。
- **订阅源管理** — 设置页面新增订阅源管理卡片，支持添加、编辑、删除订阅源，配置刷新间隔。

### 数据库变更

| 迁移               | 内容                                            |
| ------------------ | ----------------------------------------------- |
| 009\_feed\_sources | 新增 `feed_sources` 表（订阅源配置）             |
| 010\_feed_entries  | 新增 `feed_entries` 表（订阅文章条目）           |

### IPC 通道新增

| 通道                          | 说明                                |
| ----------------------------- | ----------------------------------- |
| `feed:getAll`                 | 获取所有订阅源                      |
| `feed:create`                 | 创建订阅源                          |
| `feed:update`                 | 更新订阅源                          |
| `feed:delete`                 | 删除订阅源                          |
| `feed:refresh`                | 刷新指定订阅源                      |
| `feed:refreshAll`             | 刷新所有订阅源                      |
| `feed:getEntries`             | 获取订阅文章列表                    |
| `translate:translateText`     | 翻译文本内容                        |

### 文件变更汇总

| 操作 | 文件                                                            |
| ---- | --------------------------------------------------------------- |
| 新增 | `src/main/database/repositories/feed.repo.ts`                  |
| 新增 | `src/main/ipc/feed.ipc.ts`                                      |
| 新增 | `src/main/services/feed-service.ts`                             |
| 新增 | `src/main/services/translate-service.ts`                        |
| 新增 | `src/renderer/src/views/FeedView.tsx`                           |
| 修改 | `src/main/database/migrations/index.ts` — 009/010 迁移          |
| 修改 | `src/main/database/types.ts` — Feed 类型定义                    |
| 修改 | `src/main/ipc/index.ts` — 注册 feed handlers                   |
| 修改 | `src/preload/index.ts` — feed/translate API 暴露               |
| 修改 | `src/preload/types.ts` — 添加 feed/translate 类型              |
| 修改 | `src/renderer/src/App.tsx` — 注册 FeedView 路由                |
| 修改 | `src/renderer/src/lib/api.ts` — 添加 feed/translate 方法        |
| 修改 | `src/renderer/src/components/layout/Sidebar.tsx` — 订阅源入口    |
| 修改 | `src/renderer/src/views/SettingsView.tsx` — 订阅源管理卡片      |

### 依赖变更

| 操作 | 包名                       | 用途                                |
| ---- | -------------------------- | ----------------------------------- |
| 新增 | `rss-parser@^3`            | RSS/Atom 订阅源解析                 |
| 新增 | `google-translate-api-x@^11` | 翻译服务                            |

---

## v1.2.2 (2026-04-30)

### 新增功能

- **内嵌浏览器** — 条目详情页新增"浏览原文"按钮，使用 Electron webview 内嵌浏览器直接浏览公众号文章原文，绕过图片防盗链问题。
- **Chrome 扩展图片代理** — background.js 新增 `fetchImage` 消息处理，在浏览器上下文中代理下载微信图片（设置 Referer 头），转为 base64 DataURL 传给桌面应用，绕过微信防盗链。
- **local-image:// 自定义协议** — 注册 Electron 自定义协议替代 `file://` 协议加载本地图片，解决 Markdown 预览和 TipTap 编辑器中图片无法显示的问题。

### Bug 修复

- **微信图片防盗链** — 修复后端直接下载微信图片返回防盗链提示图的问题，改用 Chrome 扩展在浏览器上下文中代理下载。
- **Markdown 图片预览** — 修复 Markdown 编辑器预览中图片显示为小图标的问题，使用 `local-image://` 自定义协议替代 `file://`。

### 文件变更

| 操作 | 文件 |
|------|------|
| 修改 | `extension/background.js` — 新增 fetchImage 消息处理 |
| 修改 | `extension/content.js` — 微信图片提取改为 base64 模式 |
| 修改 | `extension/manifest.json` — 新增 host_permissions |
| 修改 | `src/main/index.ts` — 注册 local-image:// 自定义协议 |
| 修改 | `src/main/window.ts` — 启用 webviewTag |
| 修改 | `src/main/services/image-downloader.ts` — 新增 saveBase64Image 函数 |
| 修改 | `src/main/services/native-messaging.ts` — 处理 base64 图片数据，使用 local-image:// 协议 |
| 修改 | `src/main/services/editor-image.service.ts` — 返回 local-image:// 协议路径 |
| 修改 | `src/main/services/content-extractor.ts` — 移除微信 data-src 预处理 |
| 修改 | `src/renderer/src/views/ItemDetailView.tsx` — 新增内嵌浏览器，图片使用 local-image:// 协议 |

---

## v1.2.1 (2026-04-30)

### Bug 修复

- **Markdown 标题样式** — 修复预览区域标题字体大小无差异问题，为 h1-h6 添加明确的字体大小（2em \~ 0.9em）、间距和边框样式。
- **Markdown 编辑器图片上传** — 为 MarkdownEditor 添加图片拖放、粘贴和选择功能，图片保存到本地并使用 `file://` 路径引用。
- **条目预览标签显示** — 在全部条目页面的预览面板中添加标签渲染，以彩色圆角标签形式显示在标题下方。
- **微信公众号文章图片** — 修复复制公众号文章时图片无法显示的问题：将 `data-src` 属性替换为 `src`，确保本地路径使用 `file://` 协议，扩展图片下载逻辑到所有浏览器扩展保存的网页。

### 文件变更

| 操作 | 文件                                                                       |
| -- | ------------------------------------------------------------------------ |
| 修改 | `src/renderer/src/styles/globals.css` — 添加 Markdown 预览标题样式               |
| 修改 | `src/renderer/src/components/editor/MarkdownEditor.tsx` — 添加图片拖放/粘贴/选择功能 |
| 修改 | `src/renderer/src/views/ItemDetailView.tsx` — 传递 itemId 给 MarkdownEditor |
| 修改 | `src/renderer/src/views/HomeView.tsx` — 预览面板显示标签                         |
| 修改 | `src/main/services/native-messaging.ts` — 修复微信图片替换逻辑，扩展图片下载              |
| 修改 | `src/main/services/content-extractor.ts` — 预处理微信文章 `data-src` → `src`    |

### 依赖变更

| 操作 | 包名                                            | 用途     |
| -- | --------------------------------------------- | ------ |
| 新增 | `@uiw/react-codemirror` — CodeMirror React 封装 | <br /> |
| 新增 | `@codemirror/lang-markdown` — Markdown 语言支持   | <br /> |
| 新增 | `@codemirror/language-data` — 代码块多语言高亮        | <br /> |
| 新增 | `@codemirror/commands` — 编辑器命令                | <br /> |
| 新增 | `@codemirror/search` — 搜索功能                   | <br /> |
| 新增 | `@uiw/codemirror-theme-github` — GitHub 主题    | <br /> |
| 新增 | `rehype-raw` — 预览支持原始 HTML                    | <br /> |

***

## v1.2.0 (2026-04-29)

### 新增功能

- **双向链接 (P0)** — `[[条目标题]]` Markdown 语法自动创建条目关联关系。在条目详情页可查看出链（本文引用的条目）和反向链接（引用本文的条目）。新增 `item_links` 表、`link.repo.ts`、`BacklinksPanel` 组件。
- **快速捕获 (P1)** — `Alt+Shift+K` 全局快捷键弹出无框置顶迷你窗口，支持快速输入标题、内容、选择文件夹/标签。`Ctrl+Enter` 保存，`Esc` 关闭。新增 `shortcut-manager.ts`、`QuickCaptureView`。
- **版本管理 (P2)** — 编辑条目时自动比对 SHA256 内容哈希，仅在内容变更时创建新版本。支持版本列表展开/折叠预览，一键回滚到历史版本。新增 `item_revisions` 表、`revision.repo.ts`、`RevisionPanel` 组件。
- **统计仪表盘 (P3)** — 饼图（内容类型分布）、柱状图（来源分布）、折线图（12 月趋势）、Tag 使用量排行。新增 `#/stats` 路由、`StatsDashboard` 组件、`getDashboardStats` API。依赖新增 `recharts`。
- **批量导入 (P4)** — 支持导入 Obsidian Vault（递归扫描 `.md` 文件 + YAML frontmatter 解析，自动提取 tags）+ 导入浏览器书签（Netscape HTML 格式解析为文件夹 + 书签条目）。新增 `obsidian-importer.ts`、`bookmark-importer.ts`、`import.ipc.ts`。
- **自定义模板 (P5)** — 条目新增 `is_template` / `template_category` 字段。创建条目时可标记为模板，模板列表可按分类筛选。新增迁移 007、`getTemplates()` API。
- **图片 OCR 识别 (P6)** — 拖拽导入图片时，后台异步调用 Tesseract.js 识别中英文文字，识别结果存入 `metadata.ocr_text`。支持在设置中开关 OCR 功能。新增 `ocr-service.ts`，依赖新增 `tesseract.js`。

### 数据库变更

| 迁移                   | 内容                                                                               |
| -------------------- | -------------------------------------------------------------------------------- |
| 005\_item\_links     | 新增 `item_links` 表（source\_item\_id, target\_item\_id, link\_text）                |
| 006\_item\_revisions | 新增 `item_revisions` 表（item\_id, title, content, content\_hash, revision\_number） |
| 007\_templates       | `items` 表新增 `is_pinned`, `is_template`, `template_category` 列                    |

### 文件变更汇总

| 操作 | 文件                                                         |
| -- | ---------------------------------------------------------- |
| 新增 | `src/main/database/repositories/link.repo.ts`              |
| 新增 | `src/main/database/repositories/revision.repo.ts`          |
| 新增 | `src/main/ipc/shortcut.ipc.ts`                             |
| 新增 | `src/main/ipc/import.ipc.ts`                               |
| 新增 | `src/main/services/ocr-service.ts`                         |
| 新增 | `src/main/services/obsidian-importer.ts`                   |
| 新增 | `src/main/services/bookmark-importer.ts`                   |
| 新增 | `src/main/shortcut-manager.ts`                             |
| 新增 | `src/renderer/src/views/QuickCaptureView.tsx`              |
| 新增 | `src/renderer/src/views/StatsView.tsx`                     |
| 新增 | `src/renderer/src/components/detail/BacklinksPanel.tsx`    |
| 新增 | `src/renderer/src/components/detail/RevisionPanel.tsx`     |
| 新增 | `src/renderer/src/components/dashboard/StatsDashboard.tsx` |
| 修改 | `src/main/database/migrations/index.ts`                    |
| 修改 | `src/main/database/types.ts`                               |
| 修改 | `src/main/database/repositories/item.repo.ts`              |
| 修改 | `src/main/database/repositories/tag.repo.ts`               |
| 修改 | `src/main/database/repositories/folder.repo.ts`            |
| 修改 | `src/main/ipc/index.ts`                                    |
| 修改 | `src/main/ipc/item.ipc.ts`                                 |
| 修改 | `src/main/ipc/file.ipc.ts`                                 |
| 修改 | `src/main/ipc/settings.ipc.ts`                             |
| 修改 | `src/main/utils/config.ts`                                 |
| 修改 | `src/main/window.ts`                                       |
| 修改 | `src/main/index.ts`                                        |
| 修改 | `src/preload/index.ts`                                     |
| 修改 | `src/preload/types.ts`                                     |
| 修改 | `src/renderer/src/App.tsx`                                 |
| 修改 | `src/renderer/src/lib/api.ts`                              |
| 修改 | `src/renderer/src/views/ItemDetailView.tsx`                |
| 修改 | `src/renderer/src/views/SettingsView.tsx`                  |
| 修改 | `src/renderer/src/components/layout/Sidebar.tsx`           |
| 修改 | `package.json`                                             |

### 依赖变更

| 操作 | 包名                | 用途          |
| -- | ----------------- | ----------- |
| 新增 | `recharts@^3.8.1` | 统计仪表盘图表     |
| 新增 | `tesseract.js@^6` | 图片 OCR 文字识别 |

***

## v1.1.0 (2026-03)

### 核心功能

- 条目管理 — 创建、编辑、删除知识条目，支持 Markdown 编辑和 7 种内容类型（note/article/bookmark/file/code/image/other）
- 文件夹体系 — 树形文件夹结构，支持无限层级嵌套
- 标签系统 — 多标签分类，支持按标签筛选
- 全文搜索 — 基于 MySQL ngram 分词器，搜索标题、正文、摘要
- 收藏夹/归档 — 快速收藏、归档条目
- 回收站 — 软删除 + 恢复 + 清空
- 时间线 — 按日期分组显示：今天、昨天、本周、更早
- 文件导入 — 拖拽/粘贴导入文件，自动识别内容类型
- 网页保存 — 通过 Chrome 扩展或 URL 导入保存网页内容
- Windows 右键菜单 — 资源管理器右键一键保存文件到知识库
- Chrome 浏览器扩展 — Manifest V3 + Native Messaging

### 技术架构

- Electron 33 + React 19 + TypeScript 5
- electron-vite 三段构建
- MySQL + mysql2/promise 连接池
- Zustand 5 状态管理
- Tailwind CSS 3 样式
- Content Security Policy (CSP) 安全头
- contextBridge 安全隔离

### 数据库

- 5 张业务表：folders, tags, items, item\_tags, attachments
- 全文索引：FT\_ITEMS\_SEARCH(title, content, summary) WITH PARSER ngram
- 迁移系统：\_migrations 表 + 版本化 SQL

