# 知识库 2.0 版本规划

## 现状评估

经过全面代码审查，当前 v1.0 存在以下核心痛点：
- 编辑器仅 textarea，无实时预览
- 无导出功能，数据只进不出
- 搜索无分页、无相关性排序、无高级语法
- HTML 内容直接渲染存在 XSS 风险
- 无版本历史、无回收站
- 事件系统已定义但未激活
- Native Messaging 的 get-tags 返回硬编码数据

## 2.0 版本分阶段规划

> 考虑到项目规模和个人开发资源，将功能分为 4 个阶段，每阶段产出可用的增量版本。

---

### 第一阶段：基础增强（2-3 周）

优先解决核心痛点，让日常使用体验达标。

| 功能 | 描述 | 复杂度 |
|------|------|--------|
| **回收站** | 条目软删除 + 回收站页面 + 恢复/永久删除 | 中 |
| **笔记编辑器升级** | 引入 TipTap 编辑器，支持 Markdown 快捷输入 + 实时预览 + 代码块高亮 + 工具栏 | 高 |
| **全文搜索增强** | 搜索结果分页 + 相关性排序 + 关键词高亮片段 + 搜索建议 | 中 |
| **导出功能** | 单条导出 Markdown/JSON/PDF，批量导出 ZIP | 中 |
| **修复 Native Messaging** | get-tags/get-folders 接入真实数据库 | 低 |

**数据库变更**：
- `items` 表添加 `deleted_at DATETIME NULL` 字段（软删除）
- `items` 表添加 `version INT DEFAULT 1` 字段（版本追踪）
- 新增 `item_versions` 表（版本历史快照）

**新增路由**：`/trash`（回收站）

---

### 第二阶段：知识管理增强（2-3 周）

增强知识关联和标签能力。

| 功能 | 描述 | 复杂度 |
|------|------|--------|
| **双向链接** | `[[条目名]]` 语法解析 + 反向链接面板 + 链接自动补全 | 高 |
| **标签系统增强** | 多级标签（父标签/子标签）+ 标签云 + 自动推荐标签 + 标签使用统计 | 中 |
| **版本历史** | 自动保存修改快照 + 版本对比 + 回滚到历史版本 | 高 |
| **批量操作增强** | 批量移动、批量加标签、批量导出 | 中 |
| **自定义元数据** | 条目自定义字段（会议地点、参会单位等）+ 按自定义字段筛选 | 中 |

**数据库变更**：
- `tags` 表添加 `parent_id BIGINT NULL` 字段（标签层级）
- `items` 表的 `metadata` JSON 字段增强（存储自定义字段定义和值）
- 新增 `item_versions` 表结构：
  ```sql
  CREATE TABLE item_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT NOT NULL,
    title VARCHAR(500),
    content LONGTEXT,
    content_html LONGTEXT,
    summary VARCHAR(1000),
    metadata JSON,
    version INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    INDEX idx_item_versions_item_id (item_id)
  );
  ```

**新增 IPC**：
- `item:getVersions` - 获取条目版本列表
- `item:getVersion` - 获取特定版本
- `item:restoreVersion` - 回滚到特定版本
- `item:batchMove` - 批量移动
- `item:batchTag` - 批量打标签
- `item:export` - 导出条目
- `item:batchExport` - 批量导出
- `tag:getStats` - 标签使用统计
- `tag:suggest` - 标签自动推荐

---

### 第三阶段：智能与自动化（2-3 周）

引入 AI 能力和智能过滤。

| 功能 | 描述 | 复杂度 |
|------|------|--------|
| **AI 摘要与待办提取** | 调用本地/云端 LLM 对文档自动生成摘要、提取待办事项 | 高 |
| **智能文件夹/过滤视图** | 自定义规则（标签=工作且类型=会议纪要）自动归集条目 | 中 |
| **知识图谱** | 可视化显示条目间的双向链接关系（D3.js 力导向图） | 高 |
| **阅读列表/待办** | 标记"稍后阅读"、添加提醒日期、简单看板（未读/进行中/完成） | 中 |
| **日历视图** | 按创建日期在日历上展示条目 | 中 |
| **统计看板** | 条目数量分布、标签使用频率、活跃趋势图表 | 中 |

**数据库变更**：
- `items` 表添加 `read_status ENUM('unread','reading','done') DEFAULT 'unread'`
- `items` 表添加 `reminder_date DATETIME NULL`
- 新增 `smart_folders` 表：
  ```sql
  CREATE TABLE smart_folders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rules JSON NOT NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  ```

**新增路由**：`/graph`（知识图谱）、`/calendar`（日历视图）、`/board`（看板）、`/stats`（统计）

**新增依赖**：
- `d3` 或 `@antv/g6` - 知识图谱可视化
- `echarts` 或 `recharts` - 统计图表
- `@tiptap/extension-link` - 双向链接扩展

---

### 第四阶段：导入导出与外部集成（2-3 周）

增强外部数据流通能力。

| 功能 | 描述 | 复杂度 |
|------|------|--------|
| **Web 剪藏增强** | 保存前编辑（标题/标签/文件夹选择）+ 选区剪藏 + 截图保存 | 中 |
| **导入增强** | 导入浏览器书签 HTML、Notion 导出 ZIP、Obsidian Markdown 文件夹 | 高 |
| **导出增强** | 导出为 PDF（带排版）、Markdown 文件夹、JSON、ZIP 打包 | 中 |
| **全局快捷键** | 快速创建笔记（Ctrl+Shift+N）、聚焦搜索（Ctrl+K） | 低 |
| **自定义元数据筛选** | 按自定义字段值筛选条目 | 中 |

**新增 IPC**：
- `import:bookmarks` - 导入浏览器书签
- `import:notion` - 导入 Notion 导出文件
- `import:obsidian` - 导入 Obsidian 文件夹
- `export:pdf` - 导出 PDF
- `export:markdown` - 导出 Markdown
- `export:json` - 导出 JSON

**新增依赖**：
- `pdfkit` 或 `puppeteer` - PDF 生成
- `archiver` - ZIP 打包
- `adm-zip` - ZIP 解包（Notion 导入）

---

### 远期规划（3.0+）

以下功能架构复杂度高，建议作为 3.0 版本考虑：

| 功能 | 原因 |
|------|------|
| **协同与同步** | WebDAV/云盘同步需要冲突解决机制，架构复杂 |
| **分享链接** | 需要公网服务或内网穿透，超出本地应用范畴 |
| **条目评论/批注** | 需要用户系统，当前架构不支持 |
| **移动端** | 需要独立的前端架构（React Native 或移动网页） |
| **PDF/Word/图片 OCR 全文搜索** | 需要集成 OCR 引擎（Tesseract.js）和 PDF 解析器，性能开销大 |
| **音视频预览** | 需要流媒体处理，Electron 内嵌播放器兼容性问题多 |

---

## 第一阶段详细实施步骤

### Step 1: 回收站（软删除）
- 数据库迁移：items 添加 `deleted_at` 字段
- 修改 item.repo.ts：所有查询添加 `WHERE deleted_at IS NULL`，添加 `softDelete`/`restore`/`permanentDelete`/`findDeleted` 方法
- 修改 item.ipc.ts：`item:delete` 改为软删除，添加 `item:restore`/`item:permanentDelete`/`item:emptyTrash`
- 添加回收站页面 `/trash`
- 修改 Sidebar 添加回收站入口

### Step 2: 笔记编辑器升级（TipTap）
- 安装 TipTap 依赖：`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-code-block-lowlight`
- 创建 TipTapEditor 组件（工具栏 + 编辑区 + 预览）
- 修改 ItemDetailView.tsx：编辑模式使用 TipTapEditor 替代 textarea
- 支持 Markdown 快捷输入（TipTap 原生支持）
- 支持代码块语法高亮（lowlight + highlight.js）
- 支持 `[[条目名]]` 语法高亮显示（为第二阶段双向链接做准备）

### Step 3: 全文搜索增强
- 修改 item.repo.ts：search 方法添加分页、相关性排序（MATCH...AGAINST 分数）
- 修改 SearchView.tsx：搜索结果分页、关键词高亮片段、搜索建议
- 添加搜索历史（localStorage 存储）

### Step 4: 导出功能
- 单条导出：Markdown 文件下载、JSON 文件下载、PDF 导出（使用浏览器打印）
- 批量导出：ZIP 打包（使用 JSZip 在前端打包）
- 添加导出按钮到 ItemDetailView 和批量操作栏

### Step 5: 修复 Native Messaging
- 修改 native-messaging.ts：get-tags 调用 tagRepo.findAll()，get-folders 调用 folderRepo.getTree()
- 移除硬编码假数据

### Step 6: 构建验证

---

## 涉及的关键文件（第一阶段）

| 文件 | 修改内容 |
|------|---------|
| `src/main/database/migrations/index.ts` | 添加 003_soft_delete 迁移 |
| `src/main/database/repositories/item.repo.ts` | 软删除 + 搜索增强 |
| `src/main/database/types.ts` | 添加新类型 |
| `src/main/ipc/item.ipc.ts` | 新增 IPC handler |
| `src/renderer/src/views/ItemDetailView.tsx` | TipTap 编辑器 |
| `src/renderer/src/views/SearchView.tsx` | 搜索增强 |
| `src/renderer/src/views/TrashView.tsx` | 新建回收站页面 |
| `src/renderer/src/components/layout/Sidebar.tsx` | 回收站入口 |
| `src/renderer/src/App.tsx` | 新路由 |
| `src/main/services/native-messaging.ts` | 修复硬编码数据 |
| `src/preload/index.ts` | 新增 API |
