# 知识库 2.0 版本实施计划

## 现状评估

经过对整个代码库的审查，当前 v1.0 具备以下基础能力：

* 文件导入（拖拽、右键菜单、URL 导入）

* 支持软件内新建文件

* 文件夹/标签管理（CRUD）

* 基础搜索（MySQL FULLTEXT + ngram）

* 文件预览（图片/PDF/Office/HTML/Markdown）

* 批量删除、移动到文件夹

* 收藏、归档

**核心缺陷**：

* 编辑器仅 textarea，无实时预览、无工具栏

* 无导出功能，数据只进不出

* 搜索无分页、无关键词高亮片段、无搜索建议

* 无版本历史、无回收站

* Native Messaging 的 get-tags 返回硬编码数据

* 无双向链接、无标签层级、无知识图谱

* 无 AI 能力、无智能文件夹

* 无日历视图、无统计看板、无阅读列表

* 无全局快捷键

* HTML 内容直接渲染存在 XSS 风险

***

## 分阶段实施

> 考虑到项目规模和个人开发资源，将功能分为 4 个阶段，每阶段产出可用的增量版本。

***

### 第一阶段：基础增强

优先解决核心痛点，让日常使用体验达标。

| # | 功能                      | 描述                                                  | 复杂度 |
| - | ----------------------- | --------------------------------------------------- | --- |
| 1 | **回收站**                 | 条目软删除 + 回收站页面 + 恢复/永久删除/清空                          | 中   |
| 2 | **笔记编辑器升级**             | 引入 TipTap 编辑器，支持 Markdown 快捷输入 + 实时预览 + 代码块高亮 + 工具栏 | 高   |
| 3 | **全文搜索增强**              | 搜索结果分页 + 相关性排序 + 关键词高亮片段 + 搜索建议                     | 中   |
| 4 | **导出功能**                | 单条导出 Markdown/JSON/PDF，批量导出 ZIP                     | 中   |
| 5 | **修复 Native Messaging** | get-tags/get-folders 接入真实数据库                        | 低   |

***

### 第二阶段：知识管理增强

增强知识关联和标签能力。

| #  | 功能         | 描述                                   | 复杂度 |
| -- | ---------- | ------------------------------------ | --- |
| 6  | **双向链接**   | `[[条目名]]` 语法解析 + 反向链接面板 + 链接自动补全     | 高   |
| 7  | **标签系统增强** | 多级标签（父标签/子标签）+ 标签云 + 自动推荐标签 + 标签使用统计 | 中   |
| 8  | **版本历史**   | 自动保存修改快照 + 版本对比 + 回滚到历史版本            | 高   |
| 9  | **批量操作增强** | 批量移动、批量加标签、批量导出                      | 中   |
| 10 | **自定义元数据** | 条目自定义字段（会议地点、参会单位等）+ 按自定义字段筛选        | 中   |

***

### 第三阶段：智能与自动化

引入 AI 能力和智能过滤。

| #  | 功能             | 描述                              | 复杂度 |
| -- | -------------- | ------------------------------- | --- |
| 11 | **AI 摘要与待办提取** | 调用本地/云端 LLM 对文档自动生成摘要、提取待办事项    | 高   |
| 12 | **智能文件夹/过滤视图** | 自定义规则（标签=工作且类型=会议纪要）自动归集条目      | 中   |
| 13 | **知识图谱**       | 可视化显示条目间的双向链接关系（D3.js 力导向图）     | 高   |
| 14 | **阅读列表/待办**    | 标记"稍后阅读"、添加提醒日期、简单看板（未读/进行中/完成） | 中   |
| 15 | **日历视图**       | 按创建日期或会议日期在日历上展示条目              | 中   |
| 16 | **统计看板**       | 条目数量分布、标签使用频率、活跃趋势图表            | 中   |

***

### 第四阶段：导入导出与效率

增强外部数据流通能力和操作效率。

| #  | 功能           | 描述                                               | 复杂度 |
| -- | ------------ | ------------------------------------------------ | --- |
| 17 | **Web 剪藏增强** | 保存前编辑（标题/标签/文件夹选择）+ 选区剪藏 + 截图保存                  | 中   |
| 18 | **导入增强**     | 导入浏览器书签 HTML、Notion 导出 ZIP、Obsidian Markdown 文件夹 | 高   |
| 19 | **导出增强**     | 导出为 PDF（带排版）、Markdown 文件夹、JSON、ZIP 打包            | 中   |
| 20 | **全局快捷键**    | 快速创建笔记（Ctrl+Shift+N）、聚焦搜索（Ctrl+K）                | 低   |
| 21 | **拖拽添加文件增强** | 直接拖入文件夹自动导入                                      | 低   |

***

### 远期规划（3.0+）

| 功能                       | 原因                                       |
| ------------------------ | ---------------------------------------- |
| **协同与同步**                | WebDAV/云盘同步需要冲突解决机制，架构复杂                 |
| **分享链接**                 | 需要公网服务或内网穿透，超出本地应用范畴                     |
| **条目评论/批注**              | 需要用户系统，当前架构不支持                           |
| **移动端**                  | 需要独立的前端架构（React Native 或移动网页）            |
| **PDF/Word/图片 OCR 全文搜索** | 需要集成 OCR 引擎（Tesseract.js）和 PDF 解析器，性能开销大 |
| **音视频预览**                | 需要流媒体处理，Electron 内嵌播放器兼容性问题多             |

***

## 第一阶段详细实施步骤

### Step 1: 回收站（软删除）

**数据库变更**：

* 迁移 `003_soft_delete`：items 表添加 `deleted_at DATETIME NULL` 字段

* 添加索引 `idx_items_deleted_at`

**后端修改**：

1. `src/main/database/types.ts`：

   * `Item` 接口添加 `deletedAt: string | null`

   * `QueryOptions` 添加 `includeDeleted?: boolean`

   * 添加 `TrashQueryOptions` 类型

2. `src/main/database/repositories/item.repo.ts`：

   * `findAll()`：所有查询默认添加 `WHERE deleted_at IS NULL`，除非 `options.includeDeleted === true`

   * `findById()`：默认排除已删除条目

   * `search()`：默认排除已删除条目

   * `softDelete(id)`：设置 `deleted_at = CURRENT_TIMESTAMP`

   * `restore(id)`：设置 `deleted_at = NULL`

   * `permanentDelete(id)`：物理删除（原 `delete` 逻辑）

   * `findDeleted(options)`：查询回收站中的条目（分页）

   * `emptyTrash()`：永久删除所有 `deleted_at IS NOT NULL` 的条目

   * 修改 `delete()` → 调用 `softDelete()`

   * 修改 `batchDelete()` → 调用批量软删除

   * `toggleFavorite()` / `getStats()`：排除已删除条目

3. `src/main/ipc/item.ipc.ts`：

   * 修改 `item:delete` → 调用 `softDelete`

   * 新增 `item:restore` → 恢复条目

   * 新增 `item:permanentDelete` → 永久删除

   * 新增 `item:emptyTrash` → 清空回收站

   * 新增 `item:getTrashList` → 获取回收站列表（分页）

4. `src/preload/index.ts`：

   * 添加 `restore`、`permanentDelete`、`emptyTrash`、`getTrashList` API

**前端修改**：

1. `src/renderer/src/views/TrashView.tsx`（新建）：

   * 回收站页面，展示已删除条目列表

   * 每条提供"恢复"和"永久删除"按钮

   * 顶部"清空回收站"按钮（带确认弹窗）

   * 分页加载

2. `src/renderer/src/App.tsx`：

   * 添加 `/trash` 路由

3. `src/renderer/src/components/layout/Sidebar.tsx`：

   * 导航添加"回收站"入口（Trash2 图标）

   * 显示回收站条目数量角标

4. `src/renderer/src/views/ItemDetailView.tsx`：

   * 删除确认弹窗文案改为"确定要删除吗？条目将移入回收站"

   * 如果条目已在回收站，显示"恢复"和"永久删除"按钮

5. `src/renderer/src/lib/api.ts`：

   * 添加 `restore`、`permanentDelete`、`emptyTrash`、`getTrashList` 方法

***

### Step 2: 笔记编辑器升级（TipTap）

**安装依赖**：

```
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-code-block-lowlight @tiptap/extension-image @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-underline @tiptap/extension-text-align @tiptap/pm lowlight
```

**新建组件**：

1. `src/renderer/src/components/editor/TipTapEditor.tsx`：

   * TipTap 编辑器主组件

   * 接收 `content` / `onChange` / `readOnly` props

   * 编辑模式：工具栏 + 编辑区

   * 只读模式：渲染预览

2. `src/renderer/src/components/editor/EditorToolbar.tsx`：

   * 工具栏组件：加粗、斜体、下划线、删除线、标题（H1-H3）、有序/无序列表、任务列表、引用、代码块、链接、图片、对齐方式

   * 使用 TipTap 的 `useEditor` API 判断按钮激活状态

3. `src/renderer/src/components/editor/EditorMenuBar.tsx`：

   * 编辑器顶部菜单栏（可选）

**修改现有文件**：

1. `src/renderer/src/views/ItemDetailView.tsx`：

   * 编辑模式：用 `TipTapEditor` 替换 `textarea`

   * 保存时从 TipTap 获取 Markdown 内容（使用 `@tiptap/extension-markdown` 或 turndown）

   * 查看模式：用 `TipTapEditor` 的只读模式替换 `ReactMarkdown` 渲染

   * 保留对非笔记类型（图片、PDF、Office）的现有预览逻辑

2. `src/renderer/src/styles/globals.css`：

   * 添加 TipTap 编辑器样式（ProseMirror 样式覆盖）

***

### Step 3: 全文搜索增强

**后端修改**：

1. `src/main/database/repositories/item.repo.ts`：

   * `search()` 方法增强：

     * 添加分页参数（page, pageSize）

     * 返回 `PaginatedResult<Item>` 而非 `Item[]`

     * 添加相关性排序：`MATCH...AGAINST` 分数排序

     * 添加关键词高亮片段：使用 MySQL `SUBSTRING` + `LOCATE` 提取关键词上下文

   * 添加 `searchSuggestions(keyword)` 方法：根据前缀匹配标题返回建议

2. `src/main/ipc/item.ipc.ts`：

   * 修改 `item:search`：接收分页参数，返回分页结果

   * 新增 `item:searchSuggestions`：返回搜索建议

3. `src/preload/index.ts`：

   * 修改 `search` 方法签名

   * 添加 `searchSuggestions` 方法

**前端修改**：

1. `src/renderer/src/views/SearchView.tsx`：

   * 搜索结果分页（页码导航）

   * 关键词高亮片段显示（从后端获取的 highlighted 片段）

   * 搜索建议下拉（输入时实时显示建议列表）

   * 搜索历史（localStorage 存储，最近 20 条）

   * 搜索结果排序选项（相关性 / 时间）

2. `src/renderer/src/lib/api.ts`：

   * 更新 `search` 方法签名

   * 添加 `searchSuggestions` 方法

***

### Step 4: 导出功能

**安装依赖**：

```
npm install jszip file-saver
npm install -D @types/file-saver
```

**后端修改**：

1. `src/main/ipc/item.ipc.ts`：

   * 新增 `item:exportMarkdown`：导出单条为 Markdown 文件

   * 新增 `item:exportJSON`：导出单条为 JSON 文件

   * 新增 `item:exportPDF`：使用浏览器打印功能导出 PDF

   * 新增 `item:batchExport`：批量导出为 ZIP

2. `src/main/services/export-service.ts`（新建）：

   * `exportItemAsMarkdown(item)`：生成 Markdown 文件内容

   * `exportItemAsJSON(item)`：生成 JSON 文件内容

   * `batchExportAsZip(items)`：打包为 ZIP

3. `src/preload/index.ts`：

   * 添加 `exportMarkdown`、`exportJSON`、`exportPDF`、`batchExport` API

**前端修改**：

1. `src/renderer/src/views/ItemDetailView.tsx`：

   * 添加"导出"下拉按钮：Markdown / JSON / PDF

2. `src/renderer/src/views/HomeView.tsx`：

   * 批量操作栏添加"批量导出"按钮

3. `src/renderer/src/views/FolderView.tsx`：

   * 批量操作栏添加"批量导出"按钮

4. `src/renderer/src/lib/api.ts`：

   * 添加导出相关方法

***

### Step 5: 修复 Native Messaging

1. `src/main/services/native-messaging.ts`：

   * `handleGetTags()`：调用 `tagRepo.findAll()` 替换硬编码数据

   * `handleGetFolders()`：调用 `folderRepo.getTree()` 替换 `fileManager.getDirectoryTree()`

   * 动态导入 `tagRepo` 和 `folderRepo`

***

### Step 6: 构建验证

* 运行 `npm run build` 确保编译通过

* 手动测试所有第一阶段功能

* 验证数据库迁移正确执行

***

## 第二阶段详细实施步骤

### Step 6: 双向链接

**数据库变更**：

* 迁移 `004_bidirectional_links`：新增 `item_links` 表

  ```sql
  CREATE TABLE item_links (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_item_id BIGINT NOT NULL,
    target_item_id BIGINT NOT NULL,
    link_text VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_item_links_pair (source_item_id, target_item_id),
    INDEX idx_item_links_target (target_item_id),
    FOREIGN KEY (source_item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (target_item_id) REFERENCES items(id) ON DELETE CASCADE
  );
  ```

**后端**：

* `item.repo.ts`：添加 `findLinks`、`findBackLinks`、`saveLinks` 方法

* `item.ipc.ts`：添加 `item:getBackLinks`、`item:resolveLink`（根据标题查找条目）

* TipTap 编辑器扩展：`[[` 触发自动补全，选择条目后插入 `[[条目名]]`

**前端**：

* `ItemDetailView.tsx`：底部添加"反向链接"面板，显示引用当前条目的其他条目

* `TipTapEditor.tsx`：`[[` 输入时弹出条目搜索下拉框

* 点击 `[[条目名]]` 链接可导航到对应条目

***

### Step 7: 标签系统增强

**数据库变更**：

* 迁移 `005_tag_hierarchy`：tags 表添加 `parent_id BIGINT NULL` 字段

  ```sql
  ALTER TABLE tags ADD COLUMN parent_id BIGINT NULL;
  ALTER TABLE tags ADD INDEX idx_tags_parent_id (parent_id);
  ALTER TABLE tags ADD CONSTRAINT fk_tags_parent FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE SET NULL;
  ```

**后端**：

* `tag.repo.ts`：添加 `getTree()`、`getStats()`、`suggest()` 方法

* `tag.ipc.ts`：添加 `tag:getTree`、`tag:getStats`、`tag:suggest`

**前端**：

* `Sidebar.tsx`：标签区域改为树形展示（类似文件夹），支持展开/折叠

* 新增标签云组件：标签大小按使用频率变化

* 编辑标签时支持选择父标签

* 打标签时自动推荐（基于内容类型和已有标签）

***

### Step 8: 版本历史

**数据库变更**：

* 迁移 `006_version_history`：

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
    INDEX idx_item_versions_item_id (item_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
  ALTER TABLE items ADD COLUMN version INT NOT NULL DEFAULT 1;
  ```

**后端**：

* `item.repo.ts`：修改 `update()` 方法，保存前创建版本快照

* 新建 `item_version.repo.ts`：`create`、`findByItem`、`findById`、`restore`

* `item.ipc.ts`：添加 `item:getVersions`、`item:getVersion`、`item:restoreVersion`

**前端**：

* `ItemDetailView.tsx`：添加"版本历史"按钮，弹出版本列表

* 版本对比：显示当前版本与历史版本的 diff

* 回滚按钮：恢复到选定历史版本

***

### Step 9: 批量操作增强

**后端**：

* `item.ipc.ts`：添加 `item:batchMove`（批量移动到文件夹）、`item:batchTag`（批量打标签）

* `item.repo.ts`：实现 `batchMove`、`batchTag`

**前端**：

* `HomeView.tsx` / `FolderView.tsx`：批量操作栏添加"移动到文件夹"和"添加标签"按钮

* 移动到文件夹：弹出文件夹选择器

* 批量打标签：弹出标签选择器（多选）

***

### Step 10: 自定义元数据

**后端**：

* 利用 items 表已有的 `metadata` JSON 字段

* `item.ipc.ts`：添加 `item:updateMetadata`、`item:getMetadataFields`（获取所有已使用的元数据字段名）

* `item.repo.ts`：在 `findAll` 中支持按 metadata 字段筛选

**前端**：

* `ItemDetailView.tsx`：编辑模式下添加"自定义字段"区域

  * 添加字段：键名 + 值（文本/数字/日期）

  * 删除字段

* `HomeView.tsx`：筛选面板添加"自定义字段"筛选

* 常用模板：会议纪要模板（会议地点、参会单位、会议时间）

***

## 第三阶段详细实施步骤

### Step 11: AI 摘要与待办提取

**设计决策**：

* 支持配置 LLM API（OpenAI 兼容接口 / 本地 Ollama）

* 设置页面添加 AI 配置区域

**后端**：

* 新建 `src/main/services/ai-service.ts`：

  * `generateSummary(content)`：调用 LLM 生成摘要

  * `extractTodos(content)`：调用 LLM 提取待办事项

* `item.ipc.ts`：添加 `item:aiSummary`、`item:aiExtractTodos`

**前端**：

* `ItemDetailView.tsx`：添加"AI 摘要"和"提取待办"按钮

* `SettingsView.tsx`：添加 AI 配置（API URL、API Key、模型选择）

***

### Step 12: 智能文件夹/过滤视图

**数据库变更**：

* 迁移 `007_smart_folders`：

  ```sql
  CREATE TABLE smart_folders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rules JSON NOT NULL,
    icon VARCHAR(50) NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  ```

  rules 格式示例：`{"conditions": [{"field": "tag", "operator": "equals", "value": "工作"}, {"field": "contentType", "operator": "equals", "value": "article"}], "logic": "AND"}`

**后端**：

* 新建 `smart_folder.repo.ts`

* `item.repo.ts`：添加 `findBySmartFolderRules(rules)` 方法

* `smart_folder.ipc.ts`：CRUD + 获取匹配条目

**前端**：

* `Sidebar.tsx`：智能文件夹区域（在普通文件夹下方）

* 新建/编辑智能文件夹弹窗：规则构建器（字段 + 操作符 + 值）

* 智能文件夹视图页面

***

### Step 13: 知识图谱

**安装依赖**：

```
npm install @antv/g6
```

**前端**：

* `src/renderer/src/views/GraphView.tsx`（新建）：

  * 使用 @antv/g6 渲染力导向图

  * 节点 = 条目，边 = 双向链接

  * 点击节点跳转到条目详情

  * 支持缩放、拖拽、搜索定位

**后端**：

* `item.ipc.ts`：添加 `item:getGraphData`（返回所有条目和链接关系）

**路由**：

* `App.tsx`：添加 `/graph` 路由

* `Sidebar.tsx`：添加"知识图谱"入口

***

### Step 14: 阅读列表/待办

**数据库变更**：

* 迁移 `008_reading_list`：

  ```sql
  ALTER TABLE items ADD COLUMN read_status ENUM('unread', 'reading', 'done') NOT NULL DEFAULT 'unread';
  ALTER TABLE items ADD COLUMN reminder_date DATETIME NULL;
  ALTER TABLE items ADD COLUMN is_todo TINYINT(1) NOT NULL DEFAULT 0;
  ALTER TABLE items ADD COLUMN todo_completed TINYINT(1) NOT NULL DEFAULT 0;
  ```

**前端**：

* `src/renderer/src/views/BoardView.tsx`（新建）：看板视图（未读 / 进行中 / 完成 三列）

* `ItemDetailView.tsx`：添加阅读状态切换、提醒日期设置

* `Sidebar.tsx`：添加"阅读列表"入口

**后端**：

* `item.ipc.ts`：添加 `item:updateReadStatus`、`item:getReadingList`

***

### Step 15: 日历视图

**前端**：

* `src/renderer/src/views/CalendarView.tsx`（新建）：

  * 月视图日历，每个日期格显示当天创建的条目数量

  * 点击日期格展开条目列表

  * 支持切换月份

**路由**：

* `App.tsx`：添加 `/calendar` 路由

* `Sidebar.tsx`：添加"日历"入口

***

### Step 16: 统计看板

**安装依赖**：

```
npm install recharts
```

**前端**：

* `src/renderer/src/views/StatsView.tsx`（新建）：

  * 条目总数和类型分布饼图

  * 标签使用频率 Top 10 柱状图

  * 最近 30 天创建趋势折线图

  * 存储空间占用统计

**后端**：

* `item.ipc.ts`：增强 `item:getStats` 返回更详细的统计数据

* 添加 `item:getDailyStats`（按天统计创建数量）

**路由**：

* `App.tsx`：添加 `/stats` 路由

* `Sidebar.tsx`：添加"统计"入口

***

## 第四阶段详细实施步骤

### Step 17: Web 剪藏增强

**浏览器扩展修改**：

* 保存前弹出编辑面板：修改标题、选择文件夹、添加标签

* 支持选区剪藏：只保存选中的文本

* 支持截图保存：使用 `chrome.tabs.captureVisibleTab`

**后端**：

* `native-messaging.ts`：增强 `handleSavePage`，支持 `selectedText` 和 `screenshot` 字段

* 新增 `file:saveScreenshot` IPC：保存截图到存储目录

***

### Step 18: 导入增强

**安装依赖**：

```
npm install adm-zip
npm install -D @types/adm-zip
```

**后端**：

* 新建 `src/main/services/import-bookmarks.ts`：解析浏览器书签 HTML

* 新建 `src/main/services/import-notion.ts`：解析 Notion 导出 ZIP

* 新建 `src/main/services/import-obsidian.ts`：扫描 Obsidian Markdown 文件夹

* `file.ipc.ts`：添加 `file:importBookmarks`、`file:importNotion`、`file:importObsidian`

**前端**：

* `SettingsView.tsx`：添加"数据导入"区域，支持选择导入类型和文件

***

### Step 19: 导出增强

**后端**：

* `export-service.ts`：

  * `exportAsPDF`：使用 Puppeteer 或浏览器打印生成 PDF

  * `exportAsMarkdownFolder`：导出所有条目为 Markdown 文件夹

  * `exportAsJSON`：导出完整数据库为 JSON

  * `exportAsZip`：ZIP 打包导出

**前端**：

* `SettingsView.tsx`：添加"数据导出"区域

***

### Step 20: 全局快捷键

**后端**：

* `src/main/window.ts`：

  * 注册全局快捷键 `Ctrl+Shift+N`：创建新笔记（打开窗口并聚焦到新建笔记）

  * 注册全局快捷键 `Ctrl+K`：聚焦搜索框

  * 使用 `globalShortcut.register()`

**前端**：

* `App.tsx`：添加 `Ctrl+K` 搜索快捷键（页面内快捷键）

* 快捷键提示 UI

***

### Step 21: 拖拽添加文件增强

**前端**：

* `HomeView.tsx` / `FolderView.tsx`：

  * 拖入文件夹时自动导入文件夹内所有文件

  * 拖入时显示导入进度条

  * 导入完成后刷新列表

***

## 数据库迁移汇总

| 迁移                        | 阶段 | 内容                                                                |
| ------------------------- | -- | ----------------------------------------------------------------- |
| `003_soft_delete`         | 一  | items 添加 `deleted_at`                                             |
| `004_bidirectional_links` | 二  | 新建 `item_links` 表                                                 |
| `005_tag_hierarchy`       | 二  | tags 添加 `parent_id`                                               |
| `006_version_history`     | 二  | 新建 `item_versions` 表，items 添加 `version`                           |
| `007_smart_folders`       | 三  | 新建 `smart_folders` 表                                              |
| `008_reading_list`        | 三  | items 添加 `read_status`、`reminder_date`、`is_todo`、`todo_completed` |

***

## 新增路由汇总

| 路由          | 阶段 | 页面   |
| ----------- | -- | ---- |
| `/trash`    | 一  | 回收站  |
| `/graph`    | 三  | 知识图谱 |
| `/board`    | 三  | 阅读看板 |
| `/calendar` | 三  | 日历视图 |
| `/stats`    | 三  | 统计看板 |

***

## 新增依赖汇总

| 依赖                   | 阶段 | 用途                |
| -------------------- | -- | ----------------- |
| `@tiptap/react` + 扩展 | 一  | 富文本编辑器            |
| `lowlight`           | 一  | 代码块语法高亮           |
| `jszip`              | 一  | ZIP 打包导出          |
| `file-saver`         | 一  | 文件下载              |
| `@antv/g6`           | 三  | 知识图谱可视化           |
| `recharts`           | 三  | 统计图表              |
| `adm-zip`            | 四  | ZIP 解包（Notion 导入） |

***

## 涉及的关键文件

| 文件                                                     | 修改阶段 | 修改内容                     |
| ------------------------------------------------------ | ---- | ------------------------ |
| `src/main/database/migrations/index.ts`                | 一\~三 | 添加 003\~008 迁移           |
| `src/main/database/types.ts`                           | 一\~三 | 添加新类型定义                  |
| `src/main/database/repositories/item.repo.ts`          | 一\~三 | 软删除 + 搜索增强 + 版本 + 阅读状态   |
| `src/main/ipc/item.ipc.ts`                             | 一\~三 | 新增大量 IPC handler         |
| `src/main/services/native-messaging.ts`                | 一    | 修复硬编码数据                  |
| `src/main/services/export-service.ts`                  | 一    | 新建导出服务                   |
| `src/main/services/ai-service.ts`                      | 三    | 新建 AI 服务                 |
| `src/main/services/import-bookmarks.ts`                | 四    | 新建书签导入                   |
| `src/main/services/import-notion.ts`                   | 四    | 新建 Notion 导入             |
| `src/main/services/import-obsidian.ts`                 | 四    | 新建 Obsidian 导入           |
| `src/renderer/src/views/ItemDetailView.tsx`            | 一\~二 | TipTap 编辑器 + 反向链接 + 版本历史 |
| `src/renderer/src/views/SearchView.tsx`                | 一    | 搜索增强                     |
| `src/renderer/src/views/TrashView.tsx`                 | 一    | 新建回收站页面                  |
| `src/renderer/src/views/GraphView.tsx`                 | 三    | 新建知识图谱页面                 |
| `src/renderer/src/views/BoardView.tsx`                 | 三    | 新建看板页面                   |
| `src/renderer/src/views/CalendarView.tsx`              | 三    | 新建日历页面                   |
| `src/renderer/src/views/StatsView.tsx`                 | 三    | 新建统计页面                   |
| `src/renderer/src/components/editor/TipTapEditor.tsx`  | 一    | 新建编辑器组件                  |
| `src/renderer/src/components/editor/EditorToolbar.tsx` | 一    | 新建工具栏组件                  |
| `src/renderer/src/components/layout/Sidebar.tsx`       | 一\~三 | 回收站 + 知识图谱 + 日历 + 统计入口   |
| `src/renderer/src/App.tsx`                             | 一\~三 | 新路由                      |
| `src/preload/index.ts`                                 | 一\~三 | 新增 API                   |
| `src/renderer/src/lib/api.ts`                          | 一\~三 | 新增方法                     |
| `src/main/window.ts`                                   | 四    | 全局快捷键                    |

