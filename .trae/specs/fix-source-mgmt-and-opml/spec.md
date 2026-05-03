# 知识源管理修复与增强 Spec

## Why
知识源管理视图的布局需要调整（预置源位置、全选），文章预览缺少回到顶部功能，OPML 导入因结果字段名冲突导致前端误判为失败。

## What Changes
- 将"预置 AI 订阅源"区域从顶部移到源列表下方，OPML 导入按钮保持在顶部
- 文章 webview 预览新增"回到顶部"按钮
- 修复 OPML 导入结果解析 bug（`success` 字段名与 IPC 包装层冲突）
- OPML 导入支持从父级 outline 提取分类信息

## Impact
- Affected code:
  - `src/renderer/src/views/FeedView.tsx` — 布局调整、预览回到顶部、OPML 结果修复
  - `src/main/services/feed-service.ts` — OPML 解析支持分类提取

## ADDED Requirements

### Requirement: 文章预览回到顶部
系统 SHALL 在 webview 预览模式中提供回到顶部按钮。

#### Scenario: 点击回到顶部
- **WHEN** 用户在 webview 预览中点击"回到顶部"按钮
- **THEN** webview 页面滚动到顶部

## MODIFIED Requirements

### Requirement: 知识源管理布局调整
"预置 AI 订阅源"区域 SHALL 显示在源列表下方，OPML 导入按钮保持在顶部。

### Requirement: OPML 导入结果正确显示
OPML 导入完成后 SHALL 正确显示成功/跳过/失败数量，不再因字段名冲突显示全零。

### Requirement: OPML 导入支持分类
OPML 导入时 SHALL 从父级 outline 的 text 属性提取分类信息，赋值给子级源的 category 字段。

## REMOVED Requirements
无
