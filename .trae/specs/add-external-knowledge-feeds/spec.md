# 外部知识来源（RSS 订阅 & GitHub Star）Spec

## Why
当前知识库仅支持手动导入和浏览器剪藏，缺少自动化的外部知识获取渠道。用户需要每天手动浏览各类技术网站和 GitHub 来发现 AI 相关的新文章和项目，效率低下。通过引入 RSS 订阅和 GitHub Star 同步，可以自动聚合外部知识来源，每日筛选最新内容并一键入库。

## What Changes
- 新增 RSS/Atom 订阅源管理（添加、编辑、删除、启用/禁用）
- 新增 GitHub Star 同步（通过 GitHub Personal Access Token 获取 Star 仓库列表）
- 新增每日知识流视图（FeedView），按时间线展示所有来源的最新内容
- 新增 AI 相关预置订阅源（Hacker News AI、arXiv AI、AI 新闻博客等）
- 新增定时拉取机制（应用启动时 + 每隔一定时间自动刷新）
- 新增一键入库功能（将 Feed 条目导入为知识库条目）
- 新增批量入库功能（勾选多个条目批量导入）
- 新增来源筛选和关键词过滤（按来源类型、关键词筛选）
- **BREAKING** 数据库新增 `feed_sources` 和 `feed_items` 两张表（迁移 010）

## Impact
- Affected specs: 数据库迁移系统、IPC 注册系统、路由系统、设置页面
- Affected code:
  - `src/main/database/migrations/index.ts` — 新增迁移 010
  - `src/main/database/types.ts` — 新增 FeedSource、FeedItem 类型
  - `src/main/ipc/index.ts` — 注册 feed IPC
  - `src/main/services/` — 新增 feed-service.ts
  - `src/main/ipc/` — 新增 feed.ipc.ts
  - `src/preload/index.ts` — 新增 feed API
  - `src/renderer/src/App.tsx` — 新增 /feed 路由
  - `src/renderer/src/components/layout/Sidebar.tsx` — 新增"知识流"导航入口
  - `src/renderer/src/views/` — 新增 FeedView.tsx
  - `src/renderer/src/lib/api.ts` — 新增 feedApi
  - `src/renderer/src/views/SettingsView.tsx` — 新增"知识来源"配置区域

## ADDED Requirements

### Requirement: RSS 订阅源管理
系统 SHALL 提供 RSS/Atom 订阅源的完整管理能力。

#### Scenario: 添加 RSS 订阅源
- **WHEN** 用户在设置页面输入 RSS Feed URL 并点击添加
- **THEN** 系统验证 URL 有效性，解析 Feed 标题和描述，保存到 feed_sources 表
- **AND** 立即拉取该 Feed 的最新条目

#### Scenario: 编辑订阅源
- **WHEN** 用户修改订阅源名称或拉取间隔
- **THEN** 系统更新 feed_sources 记录

#### Scenario: 删除订阅源
- **WHEN** 用户删除一个订阅源
- **THEN** 系统删除该源及其所有未入库的 feed_items，已入库的条目保留

#### Scenario: 启用/禁用订阅源
- **WHEN** 用户切换订阅源的启用状态
- **THEN** 禁用的源不参与定时拉取

### Requirement: GitHub Star 同步
系统 SHALL 支持通过 GitHub PAT 同步用户的 Star 仓库。

#### Scenario: 配置 GitHub Token
- **WHEN** 用户在设置页面输入 GitHub Personal Access Token
- **THEN** 系统验证 Token 有效性，保存到 settings 表

#### Scenario: 同步 Star 仓库
- **WHEN** 用户点击"同步 GitHub Stars"或定时任务触发
- **THEN** 系统调用 GitHub API 获取 Star 列表，将新 Star 的仓库作为 feed_items 存储
- **AND** 每个 Star 仓库的条目包含：仓库名、描述、语言、Star 数、URL

#### Scenario: 增量同步
- **WHEN** 再次同步 GitHub Stars
- **THEN** 系统仅新增上次同步后新 Star 的仓库，已存在的跳过

### Requirement: 每日知识流视图
系统 SHALL 提供一个时间线视图展示所有外部来源的最新内容。

#### Scenario: 查看知识流
- **WHEN** 用户导航到"知识流"页面
- **THEN** 系统按发布时间倒序展示所有 feed_items
- **AND** 每条显示：来源图标、标题、摘要、发布时间、来源名称、是否已入库

#### Scenario: 按来源类型筛选
- **WHEN** 用户选择筛选条件（RSS / GitHub / 全部）
- **THEN** 系统仅展示对应类型的 feed_items

#### Scenario: 关键词搜索
- **WHEN** 用户在知识流页面输入搜索关键词
- **THEN** 系统在 feed_items 的标题和摘要中搜索匹配项

#### Scenario: 按来源筛选
- **WHEN** 用户选择特定订阅源
- **THEN** 系统仅展示该源的 feed_items

### Requirement: 一键入库
系统 SHALL 支持将 feed_item 导入为知识库条目。

#### Scenario: 单条入库
- **WHEN** 用户点击某条 feed_item 的"入库"按钮
- **THEN** 系统调用 content-extractor 提取完整内容，创建 items 记录
- **AND** 标记该 feed_item 为已入库（imported_item_id 不为空）
- **AND** 自动设置 source_type 为 'rss' 或 'github'，source_url 为原始链接

#### Scenario: 批量入库
- **WHEN** 用户勾选多条 feed_item 并点击"批量入库"
- **THEN** 系统逐条提取内容并创建 items 记录
- **AND** 显示入库进度和结果

#### Scenario: 入库时选择文件夹
- **WHEN** 用户入库时选择目标文件夹
- **THEN** 导入的条目归属到指定文件夹

### Requirement: 定时拉取
系统 SHALL 支持定时自动拉取订阅源内容。

#### Scenario: 应用启动时拉取
- **WHEN** 应用启动完成
- **THEN** 系统自动拉取所有启用的订阅源的最新内容（距上次拉取超过设定间隔的）

#### Scenario: 定时刷新
- **WHEN** 距上次拉取超过用户设定的间隔（默认 60 分钟）
- **THEN** 系统自动拉取所有启用的订阅源

#### Scenario: 手动刷新
- **WHEN** 用户点击"刷新"按钮
- **THEN** 系统立即拉取所有启用的订阅源

### Requirement: AI 相关预置订阅源
系统 SHALL 提供一组 AI 技术相关的预置 RSS 订阅源。

#### Scenario: 加载预置源
- **WHEN** 用户首次进入知识来源设置
- **THEN** 系统展示预置的 AI 相关 RSS 源列表供用户一键添加
- **AND** 预置源包括：Hacker News (AI 话题)、arXiv AI、MIT Technology Review AI、The Verge AI、VentureBeat AI 等

### Requirement: 数据库迁移
系统 SHALL 通过迁移 010 创建 feed_sources 和 feed_items 表。

#### Scenario: 执行迁移
- **WHEN** 应用启动时检测到迁移 010 未执行
- **THEN** 创建 feed_sources 表（id, name, url, type, description, icon_url, site_url, enabled, fetch_interval_minutes, last_fetched_at, created_at, updated_at）
- **AND** 创建 feed_items 表（id, source_id, title, url, summary, author, published_at, content_hash, imported_item_id, metadata, is_read, created_at）
- **AND** items 表 source_type 枚举新增 'rss' 和 'github' 值
