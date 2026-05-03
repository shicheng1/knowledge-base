# 知识源管理优化 Spec

## Why
当前知识源管理（RSS/GitHub 订阅源的添加、删除、启用/禁用）放在设置页面中，用户需要在设置和知识流之间来回切换，体验割裂。此外，知识源缺少分类能力和批量删除功能，当订阅源增多时管理困难。

## What Changes
- 将知识源管理 UI 从 SettingsView 迁移到 FeedView 页面，通过按钮切换"知识流内容"和"知识源管理"两个视图
- 在 FeedView 页面顶部添加"管理知识源"按钮，点击后切换到知识源管理模式
- 知识源新增 `category` 分类字段，支持按分类筛选和展示
- 知识源列表支持多选和批量删除
- 设置页面的"知识来源"区域保留，但改为简化版（仅保留 GitHub Trending 同步快捷入口和跳转到知识流页面的链接）
- 数据库 `feed_sources` 表新增 `category` 列（迁移 013）
- **BREAKING** 无

## Impact
- Affected specs: 数据库迁移系统、IPC 注册系统、设置页面
- Affected code:
  - `src/main/database/migrations/index.ts` — 新增迁移 013
  - `src/main/database/types.ts` — FeedSource 新增 category 字段
  - `src/main/database/repositories/feed.repo.ts` — 新增 category 支持、批量删除方法
  - `src/main/ipc/feed.ipc.ts` — 新增 batchDeleteSources、updateSource category
  - `src/main/services/feed-service.ts` — 无重大变更
  - `src/preload/index.ts` — 新增 batchDeleteSources API
  - `src/preload/types.ts` — 更新 FeedApi 类型
  - `src/renderer/src/lib/api.ts` — 更新 feedApi
  - `src/renderer/src/views/FeedView.tsx` — 新增知识源管理视图
  - `src/renderer/src/views/SettingsView.tsx` — 精简知识来源区域

## ADDED Requirements

### Requirement: 知识源管理视图整合
系统 SHALL 在知识流页面中整合知识源管理功能，用户无需跳转到设置页面即可管理 RSS/GitHub 订阅源。

#### Scenario: 切换到知识源管理模式
- **WHEN** 用户在知识流页面点击"管理知识源"按钮
- **THEN** 页面从内容列表视图切换为知识源管理视图
- **AND** 显示所有已添加的知识源列表，包含分类、名称、类型、URL、启用状态
- **AND** 提供"返回知识流"按钮切回内容视图

#### Scenario: 从知识源管理返回内容视图
- **WHEN** 用户在知识源管理模式下点击"返回知识流"按钮
- **THEN** 页面切换回内容列表视图，保留之前的筛选条件

### Requirement: 知识源管理 - 添加、编辑、删除
系统 SHALL 在知识源管理视图中提供完整的 CRUD 操作。

#### Scenario: 添加订阅源
- **WHEN** 用户在知识源管理视图填写名称、URL、类型（RSS/GitHub）和分类并提交
- **THEN** 系统创建新的 feed_source 记录并刷新列表

#### Scenario: 编辑订阅源
- **WHEN** 用户修改订阅源的名称、分类或启用状态
- **THEN** 系统更新 feed_source 记录并刷新列表

#### Scenario: 删除单个订阅源
- **WHEN** 用户点击某个订阅源的删除按钮并确认
- **THEN** 系统删除该源及其关联的 feed_items（已入库的条目不受影响）

### Requirement: 知识源分类
系统 SHALL 支持对知识源进行自定义分类。

#### Scenario: 添加源时指定分类
- **WHEN** 用户添加新订阅源时输入分类名称（如"AI 研究"、"技术博客"、"前端"）
- **THEN** 系统保存分类信息到 feed_sources.category 字段
- **AND** 分类为自由文本输入（不超过 50 字符）

#### Scenario: 按分类筛选知识源
- **WHEN** 用户在知识源管理视图选择分类筛选条件
- **THEN** 系统仅展示该分类下的知识源

#### Scenario: 编辑已有源的分类
- **WHEN** 用户修改已有知识源的分类
- **THEN** 系统更新 category 字段

### Requirement: 知识源批量删除
系统 SHALL 支持勾选多个知识源并一次性批量删除。

#### Scenario: 勾选多个知识源
- **WHEN** 用户勾选知识源列表中的复选框
- **THEN** 系统记录已选中的知识源，显示"已选择 N 项"

#### Scenario: 执行批量删除
- **WHEN** 用户选中多个知识源后点击"批量删除"按钮并确认
- **THEN** 系统删除所有选中的知识源及其关联的 feed_items
- **AND** 刷新知识源列表

#### Scenario: 取消选择
- **WHEN** 用户点击"取消选择"
- **THEN** 清除所有已选中的知识源

### Requirement: 设置页面保留简化入口
系统 SHALL 在设置页面的知识来源区域保留 GitHub Trending 同步和跳转入口。

#### Scenario: 设置页面知识来源入口
- **WHEN** 用户进入设置页面
- **THEN** 系统显示精简的知识来源区域，包含 GitHub Trending 同步按钮
- **AND** 提供"前往知识流管理知识源"按钮，点击后跳转到知识流页面

### Requirement: 数据库迁移
系统 SHALL 通过迁移 013 为 feed_sources 表添加 category 列。

#### Scenario: 执行迁移
- **WHEN** 应用启动时检测到迁移 013 未执行
- **THEN** 为 feed_sources 表新增 category VARCHAR(100) NULL 列

## MODIFIED Requirements

### Requirement: 知识流页面布局
FeedView 页面 SHALL 支持两种视图模式：内容列表和知识源管理，通过顶部按钮切换。

### Requirement: 设置页面知识来源区域
SettingsView 的知识来源区域 SHALL 精简为 GitHub Trending 快捷入口和跳转到知识流页面的链接。

## REMOVED Requirements
无移除的需求。
