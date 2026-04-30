# Markdown 编辑器打开 + 文件夹显示修复 实施计划

## 问题分析

### 问题 1：新增的 Markdown 文件没有使用 Markdown 编辑器打开

**根因**：创建新文件后，`navigate(`/item/${itemId}`)` 跳转到详情页，但页面以**查看模式**打开。由于新文件内容为空，显示"空白文档，点击编辑开始输入内容"的提示，用户需要手动点击"编辑"按钮才能进入编辑模式。

**修复方案**：
1. 创建新文件后，导航时带上查询参数 `?edit=true`
2. ItemDetailView 检测到 `?edit=true` 参数时，自动进入编辑模式
3. 适用于所有新建文件类型（Markdown 笔记、Markdown 文件、Word、Excel）

### 问题 2：新增的文件切换文件夹没有显示在对应文件夹中

**根因**：在 FolderView 中创建文件时，`folderId` 参数已正确传递给 `item.create()`，数据库中 `folder_id` 字段也正确保存。但问题可能是：
1. 从 FolderView 导航到 ItemDetailView 后，用户返回时 FolderView 没有刷新数据（React Router 缓存问题）
2. HomeView 中创建文件时没有传递 `folderId`（当前确实没传，但这是 HomeView 不是 FolderView，所以这是预期行为）

**修复方案**：
1. ItemDetailView 保存时（特别是修改 folder_id 后），确保返回上一页时数据刷新
2. FolderView 和 HomeView 在组件挂载时重新加载数据（已有 useEffect，但可能需要确保每次路由变化都刷新）
3. 使用 React Router 的 `useLocation` key 来强制刷新

---

## 详细实施步骤

### Step 1：新建文件后自动进入编辑模式

**修改 `src/renderer/src/views/HomeView.tsx`**：
- `handleCreateFile` 中 `navigate` 改为 `navigate(`/item/${itemId}?edit=true`)`

**修改 `src/renderer/src/views/FolderView.tsx`**：
- `handleCreateFile` 中 `navigate` 改为 `navigate(`/item/${itemId}?edit=true`)`

**修改 `src/renderer/src/views/ItemDetailView.tsx`**：
- 从 `useSearchParams` 读取 `edit` 参数
- 如果 `edit=true`，在 `loadItem` 完成后自动 `setEditing(true)`
- 只在首次加载时触发（避免每次重新渲染都进入编辑模式）

### Step 2：确保返回时数据刷新

**修改 `src/renderer/src/views/FolderView.tsx`**：
- 在 `useEffect` 中添加对路由变化的监听，确保每次组件获得焦点时重新加载数据

**修改 `src/renderer/src/views/HomeView.tsx`**：
- 同上，确保返回时重新加载数据

### Step 3：构建验证

- `npm run build` 确保编译通过
