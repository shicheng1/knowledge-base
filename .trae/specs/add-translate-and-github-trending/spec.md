# RSS 翻译 & GitHub Trending 替换 Star 同步 Spec

## Why
RSS 文章大多是英文，用户阅读不便，需要翻译功能帮助理解。GitHub Star 同步需要 PAT 且与个人仓库绑定，改为拉取 GitHub Trending Weekly 更通用，且入库时需与已有条目去重比较。

## What Changes
- 新增 RSS 条目翻译功能（标题+摘要翻译为中文），在知识流卡片上增加"翻译"按钮
- 新增翻译 API 集成（使用免费翻译服务，无需 API Key）
- 翻译结果缓存到 feed_items.metadata 中，避免重复翻译
- **BREAKING** 将 GitHub Star 同步替换为 GitHub Trending Weekly 拉取（无需 PAT）
- GitHub Trending 拉取后，入库时与 items 表已有条目按 URL 去重比较
- 设置页面移除 GitHub Token 配置，改为 GitHub Trending 一键启用
- feed_sources.type 枚举值 'github' 语义从 'star' 变为 'trending'

## Impact
- Affected specs: add-external-knowledge-feeds
- Affected code:
  - `src/main/services/feed-service.ts` — 替换 fetchGitHubStars 为 fetchGitHubTrending，新增 translateText
  - `src/main/ipc/feed.ipc.ts` — 修改 syncGitHubStars 为 syncGitHubTrending，新增 feed:translateItem
  - `src/preload/index.ts` — 修改 syncGitHubStars 为 syncGitHubTrending，新增 translateItem
  - `src/preload/types.ts` — 修改 FeedApi 接口
  - `src/renderer/src/lib/api.ts` — 修改 feedApi
  - `src/renderer/src/views/FeedView.tsx` — 新增翻译按钮和翻译显示
  - `src/renderer/src/views/SettingsView.tsx` — 移除 GitHub Token 配置，改为 Trending 一键启用
  - `src/main/database/migrations/index.ts` — 新增迁移 011 更新已有 github 类型源

## ADDED Requirements

### Requirement: RSS 条目翻译
系统 SHALL 提供 RSS 条目的标题和摘要翻译功能。

#### Scenario: 翻译单条条目
- **WHEN** 用户点击 feed_item 卡片上的"翻译"按钮
- **THEN** 系统调用翻译 API 将标题和摘要翻译为中文
- **AND** 翻译结果缓存到 feed_items.metadata 的 translated_title 和 translated_summary 字段
- **AND** 卡片上显示翻译后的标题和摘要，按钮变为"原文"可切换回原文

#### Scenario: 翻译结果缓存
- **WHEN** 条目已有翻译缓存（metadata 中有 translated_title）
- **THEN** 直接显示翻译结果，不再调用翻译 API

#### Scenario: 翻译失败
- **WHEN** 翻译 API 调用失败
- **THEN** 显示错误提示"翻译失败"，保留原文显示

### Requirement: GitHub Trending Weekly 拉取
系统 SHALL 支持拉取 GitHub Weekly Trending 仓库列表，无需 PAT。

#### Scenario: 拉取 Trending 仓库
- **WHEN** 用户启用 GitHub Trending 源或定时任务触发
- **THEN** 系统抓取 `https://github.com/trending?since=weekly` 页面，解析出仓库列表
- **AND** 每个仓库条目包含：仓库名、描述、语言、Star 数、本周 Star 增长、URL

#### Scenario: 入库去重比较
- **WHEN** 用户将 GitHub Trending 条目入库
- **THEN** 系统先检查 items 表中是否已存在相同 URL 的条目
- **AND** 如果已存在，提示"该条目已存在于知识库"并跳过
- **AND** 如果不存在，正常入库

#### Scenario: 一键启用 GitHub Trending
- **WHEN** 用户在设置页面点击"启用 GitHub Trending"
- **THEN** 系统自动创建 GitHub 类型的订阅源（无需 Token），并立即拉取

## MODIFIED Requirements

### Requirement: GitHub 来源类型
GitHub 类型订阅源从"Star 同步"改为"Trending Weekly 拉取"，不再需要 Personal Access Token。feed_sources.type='github' 的 URL 默认为 `https://github.com/trending?since=weekly`。

## REMOVED Requirements

### Requirement: GitHub Star 同步（通过 PAT）
**Reason**: 用户更关注热门趋势仓库而非个人 Star 列表，且 PAT 配置增加了使用门槛
**Migration**: 已有的 github 类型订阅源 URL 自动更新为 Trending URL，PAT 配置项移除
