# 个人知识库桌面应用

基于 Electron + React + TypeScript + MySQL 构建的个人知识管理系统，支持网页收藏、文件导入、全文搜索、标签分类、文件夹管理，并提供 Chrome 浏览器扩展和 Windows 右键菜单集成。

---

## 目录

- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [功能特性](#功能特性)
- [数据库设计](#数据库设计)
- [应用架构](#应用架构)
- [IPC 通信](#ipc-通信)
- [渲染进程 API](#渲染进程-api)
- [路由与页面](#路由与页面)
- [Chrome 浏览器扩展](#chrome-浏览器扩展)
- [Windows 右键菜单](#windows-右键菜单)
- [构建与打包](#构建与打包)

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron 33 | 跨平台桌面应用 |
| 构建工具 | electron-vite + Vite 5 | 主进程/preload/渲染进程三段构建 |
| 前端框架 | React 19 + TypeScript 5 | UI 渲染 |
| 路由 | react-router-dom v7 (HashRouter) | 客户端路由 |
| 状态管理 | Zustand 5 | 轻量级状态管理 |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| 数据库 | MySQL (mysql2/promise) | 数据持久化，连接池模式 |
| 全文搜索 | MySQL FULLTEXT (ngram) | 中文全文搜索 |
| 内容提取 | @mozilla/readability + jsdom + turndown | 网页正文提取转 Markdown |
| 配置存储 | electron-store v8 | 本地持久化配置 |
| 图表 | Recharts | 统计仪表盘可视化 |
| OCR | Tesseract.js | 图片文字识别（中英文） |
| 打包 | electron-builder (NSIS) | Windows 安装包 |
| 浏览器扩展 | Chrome Manifest V3 + Native Messaging | 网页保存 |

---

## 项目结构

```
knowledge-base/
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── index.ts                   # 主进程入口
│   │   ├── window.ts                  # 窗口创建与管理
│   │   ├── utils/
│   │   │   ├── config.ts              # 应用配置管理 (electron-store)
│   │   │   └── logger.ts              # 日志工具
│   │   ├── database/
│   │   │   ├── connection.ts          # MySQL 连接池
│   │   │   ├── types.ts               # 数据库类型定义
│   │   │   ├── migrations/
│   │   │   │   ├── index.ts           # 迁移运行器 (SQL 内联)
│   │   │   │   └── 001_init.sql       # 初始迁移 SQL
│   │   │   └── repositories/
│   │   │       ├── item.repo.ts       # 知识条目 Repository
│   │   │       ├── folder.repo.ts     # 文件夹 Repository
│   │   │       ├── tag.repo.ts        # 标签 Repository
│   │   │       ├── link.repo.ts       # 双向链接 Repository
│   │   │       ├── revision.repo.ts   # 版本历史 Repository
│   │   │       └── attachment.repo.ts # 附件 Repository
│   │   ├── ipc/
│   │   │   ├── index.ts               # IPC 注册入口
│   │   │   ├── item.ipc.ts            # 条目 IPC (24 个通道)
│   │   │   ├── folder.ipc.ts          # 文件夹 IPC (6 个通道)
│   │   │   ├── tag.ipc.ts             # 标签 IPC (6 个通道)
│   │   │   ├── settings.ipc.ts        # 设置 IPC (5 个通道)
│   │   │   ├── file.ipc.ts            # 文件 IPC (9 个通道)
│   │   │   ├── shell.ipc.ts           # 系统集成 IPC (3 个通道)
│   │   │   ├── integration.ipc.ts     # 浏览器集成 IPC (6 个通道)
│   │   │   ├── shortcut.ipc.ts        # 快捷键 IPC (4 个通道)
│   │   │   └── import.ipc.ts          # 批量导入 IPC (2 个通道)
│   │   ├── integrations/
│   │   │   ├── http-server.ts         # 本地 HTTP 服务器 (端口 17321)
│   │   │   ├── shell-extension.ts     # Windows 右键菜单注册
│   │   │   └── native-messaging.ts    # Chrome Native Messaging
│   │   └── services/
│   │       ├── content-extractor.ts   # 网页内容提取 (HTML → Markdown)
│   │       ├── file-manager.ts        # 文件存储管理
│   │       ├── import-service.ts      # 内容导入服务
│   │       ├── ocr-service.ts         # 图片 OCR 识别 (Tesseract.js)
│   │       ├── obsidian-importer.ts   # Obsidian Vault 导入
│   │       ├── bookmark-importer.ts   # 浏览器书签导入
│   │       └── export-service.ts      # 条目导出 (Markdown/JSON/ZIP)
│   │   ├── shortcut-manager.ts        # 全局快捷键管理
│   ├── preload/                       # 预加载脚本
│   │   ├── index.ts                   # contextBridge API 暴露
│   │   └── types.ts                   # ElectronApi 类型声明
│   └── renderer/                      # 渲染进程 (React)
│       ├── index.html                 # HTML 入口 (含 CSP)
│       └── src/
│           ├── main.tsx               # React 挂载入口
│           ├── App.tsx                # 路由配置
│           ├── lib/api.ts             # API 封装层
│           ├── styles/globals.css     # 全局样式
│           ├── stores/
│           │   ├── itemStore.ts       # 条目 Store
│           │   ├── folderStore.ts     # 文件夹 Store
│           │   └── settingsStore.ts   # 设置 Store
│           ├── components/layout/
│           │   ├── Layout.tsx         # 主布局 (侧边栏 + 内容区)
│           │   └── Sidebar.tsx        # 侧边栏 (导航 + 文件夹树 + 标签)
│           ├── components/detail/
│           │   ├── BacklinksPanel.tsx  # 双向链接面板（出链/反向链接）
│           │   └── RevisionPanel.tsx   # 版本历史面板
│           ├── components/dashboard/
│           │   └── StatsDashboard.tsx  # 统计仪表盘（饼图/柱状图/折线图）
│           └── views/
│               ├── HomeView.tsx        # 首页 (条目列表)
│               ├── FolderView.tsx      # 文件夹详情页
│               ├── ItemDetailView.tsx  # 条目详情页
│               ├── SearchView.tsx      # 搜索页
│               ├── SettingsView.tsx    # 设置页
│               ├── QuickCaptureView.tsx# 快速捕获窗口
│               └── StatsView.tsx       # 统计仪表盘页
├── extension/                         # Chrome 浏览器扩展
│   ├── manifest.json                  # Manifest V3 配置
│   ├── background.js                  # Service Worker
│   ├── content.js                     # 内容脚本
│   ├── popup/
│   │   ├── popup.html                 # 弹出窗口
│   │   ├── popup.js                   # 弹出窗口逻辑
│   │   └── popup.css                 # 弹出窗口样式
│   └── native-messaging-host/
│       ├── com.knowledgebase.host.json # NMH 配置模板
│       └── host.bat                   # NMH 启动脚本模板
├── scripts/                           # Windows 部署脚本
│   ├── register-shell-menu.bat        # 注册右键菜单
│   ├── unregister-shell-menu.bat      # 注销右键菜单
│   └── setup-native-messaging.bat     # 注册 Native Messaging Host
├── resources/
│   └── icon.png                       # 应用图标
├── init.sql                           # 数据库初始化 SQL (独立副本)
├── electron.vite.config.ts            # 构建配置
├── package.json                       # 项目配置
├── tsconfig.json                      # TypeScript 配置
├── tailwind.config.js                 # Tailwind CSS 配置
└── .npmrc                             # npm 镜像配置
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 5.7 (或 MariaDB >= 10.2)
- npm >= 9

### 安装与运行

```bash
# 1. 进入项目目录
cd knowledge-base

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev
```

### 首次使用

1. 启动应用后，进入 **设置页面**
2. 配置 MySQL 连接信息（默认：localhost:3306，用户名/密码：root）
3. 点击 **测试连接** 确认数据库连通
4. 点击 **初始化数据库** 自动创建表结构
5. 选择存储目录（用于存放导入的文件和附件）

### 构建 Windows 安装包

```bash
# 构建 + 打包
npm run build:win
```

安装包输出到 `dist/` 目录。

---

## 功能特性

### v1.1.0 核心功能

| 功能 | 说明 |
|------|------|
| 条目管理 | 创建、编辑、删除知识条目，支持 Markdown 编辑，7 种内容类型 |
| 文件夹体系 | 树形文件夹结构，支持无限层级嵌套 |
| 标签系统 | 多标签分类，支持按标签筛选 |
| 全文搜索 | 基于 MySQL ngram 分词器的中文全文搜索（标题+正文+摘要） |
| 收藏夹 | 快速收藏重要条目 |

### v1.2.0 新增功能

| 功能 | 说明 |
|------|------|
| **双向链接** | `[[条目标题]]` 语法自动创建关联，支持反向链接/出链面板 |
| **快速捕获** | `Alt+Shift+K` 全局快捷键，弹出无框置顶窗口，快速记录灵感 |
| **版本管理** | 自动保存编辑历史（SHA256 哈希比较），支持版本预览与回滚 |
| **统计仪表盘** | 饼图/柱状图/折线图展示内容类型、来源分布、月度趋势、标签热力 |
| **批量导入** | 导入 Obsidian Vault（递归 .md 扫描 + YAML 解析）、导入浏览器书签（HTML 解析） |
| **自定义模板** | 创建条目模板，快速复用结构 |
| **图片 OCR** | 导入图片时 Tesseract.js 后台识别文字，结果存入元数据，支持全文搜索 |

### 内容类型

支持 7 种内容类型：`note`（笔记）、`article`（文章）、`bookmark`（书签）、`file`（文件）、`code`（代码）、`image`（图片）、`other`（其他）。

### 来源类型

支持 7 种来源：`web`（网页）、`file`（文件）、`clipboard`（剪贴板）、`api`（API）、`import`（导入）、`manual`（手动）、`file_explorer`（资源管理器）。

---

## 数据库设计

数据库名：`knowledge_base`，字符集：`utf8mb4_unicode_ci`。

### ER 关系

```
folders (自引用树形结构)
    │
    ├── 1:N ── items ── N:M ── tags (通过 item_tags)
    │           │    │
    │           │    └── 1:N ── attachments
    │           │
    │           ├── 1:N ── item_revisions (版本历史)
    │           │
    │           └── self-ref via item_links (双向链接: source → target)
    │
settings (键值对)
_migrations (迁移记录)
```

### 表结构

#### folders — 文件夹表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 文件夹 ID |
| parent_id | BIGINT NULL FK | 父文件夹 ID（自引用） |
| name | VARCHAR(255) | 文件夹名称 |
| description | TEXT | 文件夹描述 |
| sort_order | INT | 排序顺序 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### tags — 标签表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 标签 ID |
| name | VARCHAR(100) UNIQUE | 标签名称 |
| color | VARCHAR(7) | 标签颜色（十六进制） |
| created_at | DATETIME | 创建时间 |

#### items — 知识条目表（核心表）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 条目 ID |
| title | VARCHAR(500) | 标题 |
| content | LONGTEXT | Markdown 正文 |
| content_html | LONGTEXT | HTML 内容 |
| summary | VARCHAR(1000) | 摘要 |
| content_type | ENUM | 内容类型 |
| source_url | VARCHAR(2048) | 来源 URL |
| source_type | ENUM | 来源类型 |
| source_name | VARCHAR(500) | 来源名称 |
| file_path | VARCHAR(2048) | 关联文件路径 |
| file_size | BIGINT | 文件大小 |
| mime_type | VARCHAR(255) | MIME 类型 |
| folder_id | BIGINT NULL FK | 所属文件夹 |
| is_favorite | TINYINT(1) | 是否收藏 |
| is_archived | TINYINT(1) | 是否归档 |
| is_pinned | TINYINT(1) | 是否置顶 |
| is_template | TINYINT(1) | 是否为模板 |
| template_category | VARCHAR(100) NULL | 模板分类 |
| metadata | JSON | 扩展元数据（OCR 文本等） |
| deleted_at | DATETIME NULL | 软删除时间 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**索引**：folder_id, content_type, is_favorite, is_archived, created_at, updated_at, source_type

**全文索引**：`ft_items_search(title, content, summary)` WITH PARSER ngram

#### item_tags — 条目标签关联表

| 列名 | 类型 | 说明 |
|------|------|------|
| item_id | BIGINT PK FK | 条目 ID |
| tag_id | BIGINT PK FK | 标签 ID |
| created_at | DATETIME | 关联时间 |

#### attachments — 附件表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 附件 ID |
| item_id | BIGINT FK | 所属条目 |
| file_name | VARCHAR(500) | 文件名 |
| file_path | VARCHAR(2048) | 存储路径 |
| file_size | BIGINT | 文件大小 |
| mime_type | VARCHAR(255) | MIME 类型 |
| sort_order | INT | 排序 |
| created_at | DATETIME | 创建时间 |

#### item_links — 双向链接表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 链接 ID |
| source_item_id | BIGINT FK | 源条目（包含链接的条目） |
| target_item_id | BIGINT FK | 目标条目（被引用的条目） |
| link_text | VARCHAR(500) NULL | 链接显示文本 |
| created_at | DATETIME | 创建时间 |

#### item_revisions — 版本历史表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | 修订 ID |
| item_id | BIGINT FK | 所属条目 |
| title | VARCHAR(500) NULL | 修订时的标题 |
| content | LONGTEXT NULL | 修订时的内容 |
| content_hash | VARCHAR(64) | SHA256 内容哈希 |
| revision_number | INT | 版本号 |
| created_at | DATETIME | 创建时间 |

#### settings — 系统设置表

| 列名 | 类型 | 说明 |
|------|------|------|
| key_name | VARCHAR(100) PK | 设置键名 |
| value | TEXT | 设置值 |
| type | ENUM | 值类型 (string/number/boolean/json) |
| updated_at | DATETIME | 更新时间 |

#### _migrations — 迁移记录表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 自增 ID |
| name | VARCHAR(255) UNIQUE | 迁移名称 |
| executed_at | DATETIME | 执行时间 |

---

## 应用架构

```
┌─────────────────────────────────────────────────────────┐
│                    渲染进程 (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ HomeView │  │SearchView│  │FolderView│  │Settings  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │              │         │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐ │
│  │              Zustand Stores + window.api              │ │
│  └────────────────────────┬─────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────┘
                            │ contextBridge (IPC)
┌───────────────────────────┼───────────────────────────────┐
│                    Preload (安全桥接)                       │
│  ┌────────────────────────┴─────────────────────────────┐ │
│  │  invoke() 自动解包 { success, data } → data/throw    │ │
│  │  事件频道白名单验证                                     │ │
│  └────────────────────────┬─────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────┘
                            │ ipcMain.handle / ipcMain.on
┌───────────────────────────┼───────────────────────────────┐
│                    主进程 (Node.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ IPC      │  │ Database │  │ Services │  │Integration│  │
│  │ Handlers │  │ Repos    │  │ OCR      │  │ Shell     │  │
│  │ (59通道)  │  │ (6个)    │  │ Import   │  │ HTTP Server│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐        ┌─────┴─────┐        ┌─────┴─────┐
    │  MySQL  │        │  文件系统  │        │  Windows   │
    │  数据库  │        │  (存储目录)│        │  注册表    │
    └─────────┘        └───────────┘        └───────────┘
```

---

## IPC 通信

共 59 个 IPC 通道，统一返回 `{ success: boolean, data?: any, error?: string }` 格式。Preload 层自动解包为直接返回值或抛出异常。

### 条目通道 (24 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `item:getById` | `id` | 获取条目详情 |
| `item:getList` | `QueryOptions` | 分页查询条目列表 |
| `item:create` | `CreateItemDTO` | 创建条目 |
| `item:update` | `id, data` | 更新条目 |
| `item:delete` | `id` | 删除条目（软删除） |
| `item:restore` | `id` | 恢复已删除条目 |
| `item:permanentDelete` | `id` | 永久删除条目 |
| `item:getTrashList` | `options` | 获取回收站列表 |
| `item:emptyTrash` | - | 清空回收站 |
| `item:batchDelete` | `ids[]` | 批量删除 |
| `item:search` | `keyword, options` | 全文搜索 |
| `item:searchSuggestions` | `keyword` | 搜索建议 |
| `item:toggleFavorite` | `id` | 切换收藏状态 |
| `item:togglePin` | `id` | 切换置顶状态 |
| `item:getStats` | - | 获取统计信息 |
| `item:getDashboardStats` | - | 获取仪表盘统计 |
| `item:getBacklinks` | `id` | 获取反向链接 |
| `item:getOutlinks` | `id` | 获取出链 |
| `item:getRevisions` | `id` | 获取版本历史 |
| `item:restoreRevision` | `revisionId` | 回滚到指定版本 |
| `item:getTemplates` | - | 获取模板列表 |
| `item:exportMarkdown` | `id` | 导出为 Markdown |
| `item:exportJSON` | `id` | 导出为 JSON |
| `item:batchExport` | `ids[]` | 批量导出 ZIP |

### 文件夹通道 (6 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `folder:getTree` | - | 获取文件夹树 |
| `folder:getById` | `id` | 获取文件夹详情 |
| `folder:create` | `data` | 创建文件夹 |
| `folder:update` | `id, data` | 更新文件夹 |
| `folder:delete` | `id` | 删除文件夹 |
| `folder:move` | `id, newParentId` | 移动文件夹 |

### 标签通道 (6 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `tag:getAll` | - | 获取所有标签 |
| `tag:create` | `name, color?` | 创建标签 |
| `tag:update` | `id, data` | 更新标签 |
| `tag:delete` | `id` | 删除标签 |
| `tag:getByItem` | `itemId` | 获取条目的标签 |
| `tag:setForItem` | `itemId, tagIds` | 设置条目标签 |

### 设置通道 (5 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `settings:get` | `key` | 获取配置值 |
| `settings:set` | `key, value` | 设置配置值 |
| `settings:getAll` | - | 获取所有配置 |
| `settings:testConnection` | - | 测试数据库连接 |
| `settings:initDatabase` | - | 初始化数据库 |

### 文件通道 (11 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `file:selectDirectory` | - | 选择目录对话框 |
| `file:importFile` | `path, folderId?` | 导入文件 |
| `file:importByDrag` | `files[], folderId?` | 拖拽导入文件 |
| `file:importFilesByContent` | `files[], folderId?` | 内容导入文件 |
| `file:openFile` | `path` | 打开文件 |
| `file:readFileAsBuffer` | `filePath` | 读取文件为 Buffer |
| `file:createEmptyDocx` | `fileName?` | 创建空白 Word |
| `file:createEmptyXlsx` | `fileName?` | 创建空白 Excel |
| `file:createEmptyMd` | `fileName?` | 创建空白 Markdown |
| `file:readExcelData` | `filePath` | 读取 Excel 数据 |
| `file:writeFileContent` | `filePath, content` | 写入文件内容 |

### 系统集成通道 (3 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `shell:registerMenu` | - | 注册右键菜单 |
| `shell:unregisterMenu` | - | 注销右键菜单 |
| `shell:isRegistered` | - | 查询注册状态 |

### 浏览器集成通道 (6 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `integration:isNativeMessagingRegistered` | - | 查询 NMH 注册状态 |
| `integration:registerNativeMessaging` | `extensionId` | 注册 NMH |
| `integration:unregisterNativeMessaging` | - | 注销 NMH |
| `integration:isContextMenuRegistered` | - | 查询文件右键注册状态 |
| `integration:registerContextMenu` | - | 注册文件右键菜单 |
| `integration:unregisterContextMenu` | - | 注销文件右键菜单 |

### 快捷键通道 (4 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `shortcut:register` | `accelerator?` | 注册全局快捷键 |
| `shortcut:unregister` | - | 注销全局快捷键 |
| `shortcut:isRegistered` | - | 查询注册状态 |
| `shortcut:getAccelerator` | - | 获取当前快捷键 |

### 批量导入通道 (2 个)

| 通道 | 参数 | 说明 |
|------|------|------|
| `import:obsidianVault` | `dirPath, parentFolderId?` | 导入 Obsidian Vault |
| `import:bookmarks` | `filePath, parentFolderId?` | 导入浏览器书签 |

### 主进程事件 (12 个)

`item-created`、`item-updated`、`item-deleted`、`folder-created`、`folder-updated`、`folder-deleted`、`tag-created`、`tag-updated`、`tag-deleted`、`settings-changed`、`db-connection-status`、`quick-capture:focus`

---

## 渲染进程 API

通过 `window.api` 暴露 12 个命名空间：

```typescript
window.api.item       // 条目操作 (24 个方法)
window.api.folder     // 文件夹操作 (6 个方法)
window.api.tag        // 标签操作 (6 个方法)
window.api.settings   // 设置操作 (5 个方法)
window.api.file       // 文件操作 (11 个方法)
window.api.shell      // 系统集成 (3 个方法)
window.api.integration // 浏览器集成 (6 个方法)
window.api.shortcut   // 快捷键管理 (4 个方法)
window.api.import     // 批量导入 (2 个方法)
window.api.fileImport // 拖拽/内容导入 (2 个方法)
window.api.on         // 事件监听 (白名单验证)
window.api.off        // 取消事件监听
```

---

## 路由与页面

| 路由 | 组件 | 说明 |
|------|------|------|
| `#/` | HomeView | 全部条目列表（按日期分组） |
| `#/favorites` | HomeView | 收藏夹视图 |
| `#/folder/:id` | FolderView | 文件夹详情（面包屑 + 子文件夹 + 条目列表） |
| `#/item/:id` | ItemDetailView | 条目详情（Markdown 编辑 + 标签 + 链接 + 版本） |
| `#/search` | SearchView | 全文搜索（类型/标签筛选 + 关键词高亮） |
| `#/stats` | StatsView | 统计仪表盘（饼图/柱状图/折线图） |
| `#/settings` | SettingsView | 设置页（数据库 + 存储 + 右键菜单 + 导入 + OCR） |

独立窗口：

| 路由 | 组件 | 说明 |
|------|------|------|
| `#/quick-capture` | QuickCaptureView | 快速捕获窗口（`Alt+Shift+K`，无框置顶） |

---

## Chrome 浏览器扩展

扩展名称：**知识库保存助手**（Manifest V3）

### 功能

1. **右键菜单保存**：在网页上右键 → "保存到知识库"，自动提取页面内容
2. **Popup 保存**：点击扩展图标，编辑标题、选择文件夹、添加标签后保存
3. **Native Messaging**：通过 `com.knowledgebase.host` 与桌面应用通信
4. **页面通知**：保存成功/失败时在页面上显示浮动通知

### 安装步骤

1. 在 `chrome://extensions` 开启开发者模式
2. 点击"加载已解压的扩展程序"，选择 `extension/` 目录
3. 运行 `scripts/setup-native-messaging.bat` 注册通信通道（需替换 `APP_PATH` 和 `EXTENSION_ID`）
4. 重启 Chrome

---

## Windows 右键菜单

支持在资源管理器中右键文件、文件夹、文件夹空白处，一键保存到知识库。

### 方式一：应用内设置（推荐）

在设置页面点击"注册右键菜单"按钮，自动完成注册（使用 `HKCU` 注册表，无需管理员权限）。

### 方式二：手动脚本

```bash
# 注册（需替换 APP_PATH 为实际 exe 路径）
scripts\register-shell-menu.bat

# 注销
scripts\unregister-shell-menu.bat
```

---

## 构建与打包

### npm scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（热重载） |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |
| `npm run build:unpack` | 构建未打包目录 |
| `npm run build:win` | 构建 Windows 安装包 |

### electron-builder 配置

- 目标平台：Windows x64
- 安装包格式：NSIS（支持自定义安装目录）
- ASAR 打包：启用
- 压缩：最大压缩率
- 输出命名：`KnowledgeBase-{version}-setup.exe`

### 默认配置

| 配置项 | 默认值 |
|--------|--------|
| MySQL 主机 | localhost |
| MySQL 端口 | 3306 |
| MySQL 用户 | root |
| MySQL 密码 | root |
| 数据库名 | knowledge_base |
| 存储目录 | 用户数据目录/storage |
| 主题 | system（跟随系统） |
| OCR | 关闭（需手动开启） |
