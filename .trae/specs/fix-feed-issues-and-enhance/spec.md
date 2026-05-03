# Feed 修复与增强 Spec

## Why
知识流功能存在多个体验问题：订阅源无法批量导入（OPML）、GitHub Trending 页面解析正则与当前 HTML 结构不匹配导致拉取失败、入库后删除条目仍显示已入库状态、点击链接只能外部浏览器打开而非软件内预览。

## What Changes
- 新增 OPML 文件导入功能，支持批量添加 RSS 订阅源
- 修复 GitHub Trending HTML 解析正则，适配当前页面结构
- 修复入库后删除条目仍显示"已入库"的问题（删除 items 时清除 feed_items.imported_item_id）
- FeedView 条目标题点击改为软件内 webview 预览（复用 ItemDetailView 的 webview 模式）

## Impact
- Affected code:
  - `src/main/services/feed-service.ts` — 修复 GitHub Trending 正则
  - `src/main/ipc/feed.ipc.ts` — 新增 OPML 导入 IPC
  - `src/main/services/feed-service.ts` — 新增 OPML 解析
  - `src/main/database/repositories/feed.repo.ts` — 新增 clearImportedItemId 方法
  - `src/main/database/migrations/index.ts` — 新增迁移 012 清理孤立 imported_item_id
  - `src/renderer/src/views/FeedView.tsx` — 标题点击改为软件内预览
  - `src/renderer/src/views/SettingsView.tsx` — 新增 OPML 导入按钮
  - `src/preload/index.ts` — 新增 OPML 导入 API
  - `src/preload/types.ts` — 更新 FeedApi

## ADDED Requirements

### Requirement: OPML 导入
系统 SHALL 支持通过 OPML 文件批量导入 RSS 订阅源。

#### Scenario: 导入 OPML 文件
- **WHEN** 用户在设置页面点击"导入 OPML"按钮并选择文件
- **THEN** 系统解析 OPML 文件中的 outline 元素，提取 name、xmlUrl、htmlUrl
- **AND** 对每个源调用 addSource 逻辑创建订阅源
- **AND** 返回导入结果（成功数、失败数、跳过数）

### Requirement: 软件内 URL 预览
系统 SHALL 支持在软件内通过 webview 预览 Feed 条目链接。

#### Scenario: 点击条目标题
- **WHEN** 用户点击知识流中某条目的标题
- **THEN** 系统在 FeedView 内展开一个 webview 面板加载该 URL
- **AND** 面板顶部有关闭按钮和"外部打开"按钮

## MODIFIED Requirements

### Requirement: GitHub Trending 解析
修复 fetchGitHubTrending 的 HTML 解析正则，适配 GitHub 当前页面结构（article 标签 class 变更、h2 内 a 标签结构变更）。

### Requirement: 入库状态一致性
当 items 表中的条目被删除时，系统 SHALL 同时清除对应 feed_items.imported_item_id，避免显示已失效的"已入库"状态。
