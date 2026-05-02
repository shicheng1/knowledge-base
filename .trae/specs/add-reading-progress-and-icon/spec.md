# 阅读进度与图标更换 Spec

## Why
用户在阅读长条目时，无法记住上次阅读到哪个位置，每次打开都需要重新定位。同时应用图标需要更换为用户指定的新图标。

## What Changes
- 数据库新增迁移：items 表增加 `reading_progress` 字段（DECIMAL(5,2)，存储百分比 0.00~100.00）
- 主进程新增 IPC 通道 `item:saveReadingProgress`，保存条目阅读百分比
- 主进程 item:getById 返回数据中包含 `reading_progress` 字段
- 渲染进程 ItemDetailView：监听内容区域滚动事件，计算当前阅读百分比并定时保存
- 渲染进程 ItemDetailView：打开条目时，自动滚动到上次阅读位置
- 渲染进程 ItemDetailView：在条目详情页顶部显示阅读进度条
- 替换应用图标为用户指定的 PNG 文件

## Impact
- Affected specs: 条目数据模型、条目详情页、应用图标
- Affected code:
  - `src/main/database/migrations/index.ts` — 新增 009_reading_progress 迁移
  - `src/main/database/repositories/item.repo.ts` — findById 返回 reading_progress，新增 saveReadingProgress 方法
  - `src/main/ipc/item.ipc.ts` — 新增 item:saveReadingProgress 通道
  - `src/preload/index.ts` — 新增 item.saveReadingProgress API
  - `src/renderer/src/views/ItemDetailView.tsx` — 滚动监听、自动定位、进度条 UI
  - `resources/icon.png` — 替换为用户指定图标
  - `src/main/window.ts` — 确认图标配置引用

## ADDED Requirements

### Requirement: 阅读进度持久化
系统 SHALL 记录每个条目的阅读进度百分比，并在数据库中持久化存储。

#### Scenario: 保存阅读进度
- **WHEN** 用户在条目详情页滚动内容
- **THEN** 系统每 3 秒（防抖）计算当前滚动百分比并保存到数据库
- **AND** 百分比值范围 0.00~100.00

#### Scenario: 首次打开条目
- **WHEN** 用户首次打开一个从未阅读过的条目
- **THEN** reading_progress 为 0，页面从顶部开始显示

### Requirement: 自动滚动到上次阅读位置
系统 SHALL 在打开条目时自动滚动到上次阅读的百分比位置。

#### Scenario: 有阅读记录的条目
- **WHEN** 用户打开一个 reading_progress > 0 的条目
- **THEN** 页面自动平滑滚动到对应的百分比位置

#### Scenario: 阅读进度为 100% 的条目
- **WHEN** 用户打开一个 reading_progress = 100 的条目
- **THEN** 页面滚动到底部

### Requirement: 阅读进度条显示
系统 SHALL 在条目详情页顶部显示阅读进度条。

#### Scenario: 显示进度条
- **WHEN** 用户查看条目详情（非编辑模式）
- **THEN** 页面顶部显示一个细进度条，宽度对应当前阅读百分比
- **AND** 进度条颜色为蓝色（与主题一致）

#### Scenario: 进度条实时更新
- **WHEN** 用户滚动页面
- **THEN** 进度条宽度实时更新

### Requirement: 应用图标更换
系统 SHALL 将应用图标更换为用户指定的 PNG 文件。

#### Scenario: 替换图标文件
- **WHEN** 构建应用
- **THEN** 使用用户指定的 `f99bb093-cdae-4cb1-a675-bb37ff8b1f6b.png` 作为应用图标
- **AND** 图标在窗口标题栏、任务栏、桌面快捷方式中正确显示

## MODIFIED Requirements

### Requirement: 条目数据模型
items 表新增 `reading_progress` 列，类型 DECIMAL(5,2)，默认值 0.00，用于存储阅读百分比。

### Requirement: 条目详情页
ItemDetailView 新增滚动监听逻辑，在非编辑模式下：
1. 页面加载完成后，根据 reading_progress 自动滚动
2. 滚动时计算百分比并防抖保存
3. 顶部显示进度条

## REMOVED Requirements

无
