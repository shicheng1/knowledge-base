# 知识库优化计划 - 批量删除、收藏过滤、移动到文件夹

## 问题诊断

### 问题 1：没有批量删除功能
**现状**：只能逐个进入条目详情页删除，没有批量选择和删除的 UI

**需要**：
- 条目卡片添加复选框
- 顶部添加"全选/取消全选"和"删除选中"按钮
- 主进程添加批量删除 IPC handler

### 问题 2：收藏里面显示所有文件
**根因**：`HomeView` 的 `favoriteOnly` prop 传了 `options.is_favorite = true`，但 `item.ipc.ts` 的 `getList` handler 将 options 直接传给 `itemRepo.findAll(options)`。而 `QueryOptions` 接口中字段是 `isFavorite`（camelCase），但渲染进程传的是 `is_favorite`（snake_case）。

**证据**：
- 渲染进程传 `options.is_favorite = true`（第119行）
- `QueryOptions` 类型定义中字段名是 `isFavorite`（第186行 types.ts）
- `itemRepo.findAll` 检查的是 `options.isFavorite`（第78行 item.repo.ts）
- 所以 `options.is_favorite` 被忽略了，`isFavorite` 始终为 `undefined`，导致收藏过滤不生效

**修复**：渲染进程传 `isFavorite: true` 而不是 `is_favorite: true`

### 问题 3：没有把文件移到分类文件夹的功能
**现状**：只能在编辑条目时修改 folder_id，没有从列表直接移动的功能

**需要**：
- 条目卡片右键菜单添加"移动到..."选项
- 弹出文件夹选择器
- 调用 `window.api.item.update` 修改 folder_id

---

## 实施步骤

### Step 1: 修复收藏过滤 bug
- 修改 `HomeView.tsx`：将 `options.is_favorite = true` 改为 `options.isFavorite = true`
- 修改 `options.content_type` 改为 `options.contentType`
- 修改 `options.folder_id` 改为 `options.folderId`（如果有）

### Step 2: 添加批量删除功能
- 修改 `HomeView.tsx`：
  - 添加 `selectedIds` 状态（Set<number>）
  - 添加 `isSelectMode` 状态
  - 条目卡片添加复选框
  - 顶部添加"选择"/"取消选择"/"全选"/"删除选中"按钮
  - 删除选中时弹出确认弹窗
- 修改 `item.ipc.ts`：添加 `item:batchDelete` IPC handler
- 修改 `item.repo.ts`：添加 `batchDelete` 方法
- 修改 `preload/index.ts`：暴露 `batchDelete` API
- 同样修改 `FolderView.tsx`：添加批量删除

### Step 3: 添加移动到文件夹功能
- 修改 `HomeView.tsx`：
  - 条目卡片右键菜单添加"移动到..."选项
  - 弹出文件夹选择器弹窗
  - 调用 `window.api.item.update(id, { folderId })` 移动
- 同样修改 `FolderView.tsx`

### Step 4: 构建验证

---

## 涉及的关键文件

| 文件 | 修改内容 |
|------|---------|
| `src/renderer/src/views/HomeView.tsx` | 修复收藏过滤 + 批量删除 + 移动到文件夹 |
| `src/renderer/src/views/FolderView.tsx` | 批量删除 + 移动到文件夹 |
| `src/main/ipc/item.ipc.ts` | 添加 batchDelete handler |
| `src/main/database/repositories/item.repo.ts` | 添加 batchDelete 方法 |
| `src/preload/index.ts` | 暴露 batchDelete API |
