# 个人知识库 - 需求文档

## 项目概述

个人知识库是一款基于 Electron + React + MySQL 的桌面应用，用于收集、整理和管理各类知识内容，支持网页文章保存、文件导入、Markdown 编辑、Office 文件预览等功能。

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron (electron-vite) |
| 前端 | React + TypeScript + Tailwind CSS |
| 后端 | Node.js (Electron Main Process) |
| 数据库 | MySQL 8.0 |
| 富文本编辑器 | TipTap |
| Markdown 渲染 | ReactMarkdown + remark-gfm + rehype-highlight |
| Office 预览 | docx-preview + exceljs |
| 浏览器扩展 | Chrome Extension (Native Messaging) |

### 架构

```
┌─────────────────────────────────────────┐
│           Chrome Extension              │
│  (content.js / background.js / popup)   │
└──────────────┬──────────────────────────┘
               │ Native Messaging
┌──────────────▼──────────────────────────┐
│           Electron Main Process         │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ IPC层    │ │ 服务层   │ │ 数据层  │ │
│  │ handlers │ │ services │ │ repos   │ │
│  └──────────┘ └──────────┘ └─────────┘ │
└──────────────┬──────────────────────────┘
               │ contextBridge / preload
┌──────────────▼──────────────────────────┐
│           Electron Renderer Process     │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ Views    │ │Components│ │ Stores  │ │
│  └──────────┘ └──────────┘ └─────────┘ │
└─────────────────────────────────────────┘
```

---

## 功能模块

### M1 条目管理

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M1-01 | 创建条目 | 支持手动创建笔记、Markdown 文件、Word 文档、Excel 表格 | P0 |
| M1-02 | 编辑条目 | 标题、内容、文件夹、标签编辑 | P0 |
| M1-03 | 删除条目 | 软删除，移入回收站 | P0 |
| M1-04 | 永久删除 | 从回收站彻底删除 | P0 |
| M1-05 | 恢复条目 | 从回收站恢复已删除条目 | P0 |
| M1-06 | 清空回收站 | 一键清空所有已删除条目 | P1 |
| M1-07 | 收藏条目 | 切换收藏状态，收藏夹筛选 | P0 |
| M1-08 | 置顶条目 | 切换置顶状态，置顶条目排在列表最前 | P1 |
| M1-09 | 批量删除 | 多选条目后批量删除 | P1 |
| M1-10 | 批量导出 | 多选条目后批量导出为 ZIP | P1 |
| M1-11 | 移动到文件夹 | 右键菜单移动条目到指定文件夹 | P1 |
| M1-12 | 自动编辑模式 | 新建条目自动进入编辑模式 | P1 |

### M2 文件夹管理

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M2-01 | 文件夹树 | 左侧导航栏显示文件夹树形结构 | P0 |
| M2-02 | 创建文件夹 | 支持创建根文件夹和子文件夹 | P0 |
| M2-03 | 编辑文件夹 | 修改文件夹名称 | P0 |
| M2-04 | 删除文件夹 | 删除空文件夹 | P0 |
| M2-05 | 移动文件夹 | 拖拽或菜单移动文件夹 | P1 |
| M2-06 | 面包屑导航 | 文件夹内显示层级路径 | P1 |

### M3 标签管理

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M3-01 | 创建标签 | 自定义名称和颜色 | P0 |
| M3-02 | 编辑标签 | 修改标签名称和颜色 | P0 |
| M3-03 | 删除标签 | 删除标签及关联关系 | P0 |
| M3-04 | 条目标签 | 为条目关联/取消关联标签 | P0 |

### M4 搜索

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M4-01 | 全文搜索 | MySQL FULLTEXT 索引搜索标题、内容、摘要 | P0 |
| M4-02 | 搜索建议 | 输入关键词时显示搜索建议 | P1 |
| M4-03 | 分页搜索 | 搜索结果分页展示 | P1 |
| M4-04 | 相关度排序 | 按全文搜索相关度排序 | P1 |

### M5 编辑器

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M5-01 | TipTap 富文本编辑器 | 非 Markdown 条目使用 TipTap 编辑 | P0 |
| M5-02 | Markdown 编辑器 | Markdown 文件使用 textarea 编辑 | P0 |
| M5-03 | Markdown 分屏预览 | 编辑/预览/分屏三种模式切换 | P1 |
| M5-04 | 编辑器工具栏 | TipTap 格式化工具栏 | P1 |
| M5-05 | 只读模式 | 查看模式下编辑器只读 | P0 |

### M6 文件预览

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M6-01 | Word 预览 | docx-preview 渲染 .docx 文件 | P0 |
| M6-02 | Excel 预览 | exceljs 读取 .xlsx 数据并展示表格 | P0 |
| M6-03 | Excel 筛选 | 列级筛选下拉菜单 | P1 |
| M6-04 | PDF 预览 | iframe 内嵌 PDF | P0 |
| M6-05 | 图片预览 | 直接展示图片文件 | P0 |
| M6-06 | Markdown 预览 | ReactMarkdown 渲染 | P0 |
| M6-07 | 外部打开 | 调用系统默认程序打开文件 | P0 |

### M7 导入

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M7-01 | 拖拽导入 | 拖拽文件到应用窗口导入 | P0 |
| M7-02 | 浏览器扩展保存 | Chrome 右键保存网页到知识库 | P0 |
| M7-03 | 微信文章保存 | 保存微信公众号文章，下载图片到本地 | P1 |
| M7-04 | 自动分类 | 导入时根据文件类型自动设置 content_type | P1 |
| M7-05 | 新建文件 | 创建空白 Markdown/Word/Excel 文件 | P1 |

### M8 导出

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M8-01 | 导出 Markdown | 单条目导出为 .md 文件 | P1 |
| M8-02 | 导出 JSON | 单条目导出为 .json 文件 | P1 |
| M8-03 | 批量导出 ZIP | 多条目打包为 .zip 文件 | P1 |

### M9 浏览器扩展集成

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M9-01 | Native Messaging 注册 | 注册 Chrome Native Messaging Host | P0 |
| M9-02 | Native Messaging 注销 | 清理注册信息 | P0 |
| M9-03 | 右键菜单注册 | Windows 文件右键菜单"保存到知识库" | P1 |
| M9-04 | 右键菜单注销 | 清理右键菜单注册 | P1 |

### M10 设置

| 编号 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| M10-01 | 数据库配置 | MySQL 连接配置 | P0 |
| M10-02 | 连接测试 | 测试数据库连接 | P0 |
| M10-03 | 数据库初始化 | 自动执行迁移脚本 | P0 |
| M10-04 | 存储路径 | 文件存储目录配置 | P1 |
| M10-05 | 扩展集成设置 | 浏览器扩展和右键菜单注册管理 | P1 |

---

## 数据库设计

### items 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| title | VARCHAR(255) | 标题 |
| content | TEXT | 纯文本/Markdown 内容 |
| content_html | TEXT | HTML 内容 |
| summary | TEXT | 摘要 |
| content_type | VARCHAR(50) | 内容类型 (note/article/bookmark/file/code/image/other) |
| source_url | VARCHAR(500) | 来源 URL |
| source_type | VARCHAR(50) | 来源类型 (web/file/clipboard/api/import/manual) |
| source_name | VARCHAR(255) | 来源文件名 |
| file_path | VARCHAR(500) | 本地文件路径 |
| file_size | BIGINT | 文件大小 |
| mime_type | VARCHAR(100) | MIME 类型 |
| folder_id | INT | 所属文件夹 ID |
| is_favorite | TINYINT(1) | 是否收藏 |
| is_archived | TINYINT(1) | 是否归档 |
| is_pinned | TINYINT(1) | 是否置顶 |
| metadata | JSON | 扩展元数据 |
| deleted_at | DATETIME | 软删除时间 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### folders 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| name | VARCHAR(100) | 文件夹名称 |
| parent_id | INT | 父文件夹 ID |
| description | TEXT | 描述 |
| sort_order | INT | 排序 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### tags 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| name | VARCHAR(50) | 标签名称 |
| color | VARCHAR(20) | 标签颜色 |
| created_at | DATETIME | 创建时间 |

### item_tags 表

| 字段 | 类型 | 说明 |
|------|------|------|
| item_id | INT | 条目 ID |
| tag_id | INT | 标签 ID |

---

## 迭代记录

### v1.0 - 基础功能

- 条目 CRUD（创建、读取、更新、删除）
- 文件夹树形管理
- 标签管理
- 基础搜索
- 拖拽文件导入
- Chrome 浏览器扩展（Native Messaging）
- MySQL 数据库持久化
- Electron + React + TypeScript 架构搭建

### v1.1 - 导入优化

- 修复拖拽导入二进制文件丢失问题
- 修复文件分类和预览问题
- 自动根据文件类型设置 content_type
- 支持图片、PDF 等二进制文件导入

### v1.2 - 批量操作与收藏

- 批量选择和删除
- 收藏夹筛选
- 移动条目到文件夹（右键菜单）
- 文件夹内条目列表展示

### v2.0 Phase 1 - 核心升级

- **回收站**：软删除机制（deleted_at 字段），回收站页面，恢复/永久删除/清空
- **TipTap 编辑器**：替换原有编辑器，支持富文本格式化，工具栏
- **搜索增强**：FULLTEXT 索引，分页，相关度排序，搜索建议
- **导出功能**：Markdown 导出、JSON 导出、批量 ZIP 导出
- **Native Messaging 修复**：替换硬编码数据为真实数据库查询

### v2.0 Phase 2 - Office 预览与新建文件

- **Word 预览**：docx-preview 渲染 .docx 文件
- **Excel 预览**：exceljs 读取数据，表格展示
- **新建文件**：支持创建空白 Markdown/Word/Excel 文件
- **文件 IPC**：readFileAsBuffer、createEmptyDocx/Xlsx/Md、readExcelData、writeFileContent

### v2.0 Phase 3 - 编辑器与集成修复

- **Markdown 编辑器**：MD 文件使用 textarea 编辑（非 TipTap），支持 Markdown 语法
- **Excel 筛选**：列级筛选下拉菜单，多列联合筛选
- **右键菜单修复**：创建 integration.ts 服务，Windows 注册表操作
- **集成设置页面**：浏览器扩展注册/注销，右键菜单注册/注销

### v2.0 Phase 4 - 体验优化

- **自动编辑模式**：新建文件自动进入编辑模式（?edit=true）
- **文件夹刷新**：导航返回时自动刷新文件夹内容（location.key）
- **Markdown 格式修复**：MD 文件使用 textarea 而非 TipTap，editContent 初始化从 content 字段
- **保存修复**：folder_id → folderId 命名统一，MD/HTML 保存逻辑分离

### v2.0 Phase 5 - 高级功能

- **Markdown 分屏预览**：编辑/预览/分屏三种模式切换，左侧编辑右侧实时渲染
- **微信公众号文章保存**：Chrome 扩展检测微信文章，提取正文/标题/作者/日期，图片下载到本地替换 URL
- **文件置顶**：is_pinned 字段，togglePin 切换，列表按置顶排序，置顶图标显示

### v2.0 Phase 6 - Bug 修复

- **修复标题前显示 "0"**：MySQL TINYINT 返回数字 0/1，React JSX 中 `{0 && <Component/>}` 渲染为 "0"，改用 `!!` 双取反
- **修复 Markdown 笔记保存**：创建 Markdown 笔记时添加 `mimeType: 'text/markdown'`，确保使用 Markdown 编辑器
- **需求文档**：生成需求文档，记录迭代历史

### v2.0 Phase 7 - 浏览器扩展与打包修复

- **修复微信文章保存**：background.js 改为先注入 content.js 再通过消息获取页面内容，消息格式改为 `type: 'save-page'`，NativeMessage 类型添加 isWechat/images/author/publishDate 字段
- **修复右键保存 .txt 报错**：将所有主进程代码中的动态 `import()` 改为静态 `import`，避免 ESM 解析器误处理文件路径
- **修复打包后模块找不到**：移除 `!node_modules/**/*` 排除规则，重新划分 dependencies/devDependencies
- **修复 rcedit 打包失败**：添加 `signAndEditExecutable: false` 跳过 exe 修改
- **修复 @electron-toolkit/utils 找不到**：用 `app.isPackaged` 替代 `is.dev`
- **Chrome 扩展图标**：生成 PNG 图标文件

### v2.1 - 富文本编辑器增强（当前）

- **文字颜色**：12 种预设颜色 + 原生颜色选择器，基于 TextStyle + Color 扩展
- **表格支持**：插入 3×3 默认表格（含表头），可调整行列，基于 Table/TableRow/TableCell/TableHeader 扩展
- **水平分割线**：工具栏一键插入
- **清除格式**：一键清除所有格式标记
- **上标/下标**：基于 Superscript/Subscript 扩展
- **Emoji 选择器**：32 个常用 Emoji 面板，点击插入
- **图片本地导入**：点击图片按钮弹出系统文件对话框，选择本地图片保存到 `{storageRoot}/editor-images/{itemId}/` 目录
- **拖放图片**：从文件管理器拖拽图片到编辑器，自动保存并插入
- **粘贴图片**：截图后 Ctrl+V 粘贴到编辑器，自动保存并插入
- **HTML 源码编辑**：工具栏按钮打开弹窗，直接编辑 HTML 源码
- **编辑器宽度切换**：narrow/wide/full 三种宽度模式循环切换
- **工具栏布局优化**：8 组分隔线分组，按钮排列清晰
