# 知识库优化计划 - 文件分类、预览与自动分类

## 问题诊断

### 问题 1：文件没有正确分类
**现象**：导入的文件在首页和文件夹视图中，content_type 标签显示不正确或混乱

**根因分析**：
1. `file.ipc.ts` 中 `importByDrag` 的二进制文件分支，`title` 使用了 `file.name.replace(/\.[^.]+$/, '')` 去掉扩展名，但 `contentType` 映射是正确的
2. `import-service.ts` 中 `importFromFile` 的二进制文件分支，`title` 直接用了 `fileName`（带扩展名），且 `summary` 是英文 `"Attached file: ..."`
3. 首页 `HomeView.tsx` 的 `CONTENT_TYPE_MAP` 只有 7 种类型，但实际数据库 ENUM 也是这 7 种，映射正确
4. **真正的问题**：之前导入的旧数据 content_type 可能还是错误的（如 `.txt` 被标记为 `file` 而非 `note`），需要修复已有数据

### 问题 2：不能预览文件夹中的文件
**现象**：进入文件夹后，只能看到条目列表，无法直接预览文件内容

**根因分析**：
1. `FolderView.tsx` 只有条目列表视图，没有预览面板
2. 点击条目跳转到 `ItemDetailView`，需要返回才能看到列表
3. 没有类似"列表+预览"的分栏布局

### 问题 3：不能自主分类
**现象**：导入文件时无法选择分类，文件全部归入根目录，没有文件夹

**根因分析**：
1. 拖拽导入时 `folderId` 始终为 `null`（HomeView）或当前文件夹（FolderView）
2. 没有导入时选择文件夹的 UI
3. 没有根据文件类型自动归类的功能
4. 首页没有"新建文件夹"入口（只有侧边栏有）

---

## 优化方案

### 第一阶段：修复文件分类显示 + 修复旧数据

1. **统一 title 生成逻辑**：
   - `import-service.ts`：二进制文件的 `title` 去掉扩展名，`summary` 改为中文
   - `file.ipc.ts`：同上

2. **修复已有错误数据**：
   - 添加数据库迁移脚本，将 `.txt/.md` 的 `content_type` 从 `file` 改为 `note`
   - 将 `.html/.htm` 的 `content_type` 从 `file` 改为 `article`
   - 将代码文件的 `content_type` 从 `file` 改为 `code`

3. **统一 summary 语言**：
   - 所有 `summary` 统一使用中文

### 第二阶段：文件夹内文件预览

1. **FolderView 添加侧边预览面板**：
   - 条目列表在左侧
   - 点击条目在右侧显示预览（类似邮件客户端布局）
   - 预览内容根据 content_type 显示不同预览（复用 ItemDetailView 的预览逻辑）

2. **HomeView 添加侧边预览面板**：
   - 同上，列表+预览的分栏布局

### 第三阶段：自动分类功能

1. **导入时选择文件夹**：
   - 拖拽导入后弹出对话框，让用户选择目标文件夹
   - 或者默认根据文件类型自动分类

2. **自动分类规则**：
   - 根据文件扩展名自动创建/匹配文件夹
   - 规则：图片文件 → "图片"文件夹，代码文件 → "代码"文件夹，文档文件 → "文档"文件夹
   - 用户可在设置中配置自动分类规则

3. **首页添加"新建文件夹"按钮**：
   - 在 HomeView 的标题栏添加操作按钮

---

## 实施步骤

### Step 1: 统一 title/summary 生成 + 修复旧数据
- 修改 `import-service.ts`：统一 title 去掉扩展名，summary 改中文
- 修改 `file.ipc.ts`：同上
- 添加数据库迁移 `002_fix_content_types`：修复已有数据的 content_type

### Step 2: 文件夹内文件预览 - FolderView 分栏布局
- 修改 `FolderView.tsx`：添加右侧预览面板
- 点击条目在右侧显示预览，不需要跳转

### Step 3: 首页文件预览 - HomeView 分栏布局
- 修改 `HomeView.tsx`：添加右侧预览面板
- 同上

### Step 4: 自动分类功能
- 修改 `file.ipc.ts`：添加自动分类逻辑（根据扩展名自动匹配/创建文件夹）
- 修改 `import-service.ts`：同上
- 修改 `HomeView.tsx`：添加"新建文件夹"按钮
- 添加自动分类配置到设置页面

### Step 5: 构建验证

---

## 涉及的关键文件

| 文件 | 修改内容 |
|------|---------|
| `src/main/services/import-service.ts` | 统一 title/summary，添加自动分类 |
| `src/main/ipc/file.ipc.ts` | 统一 title/summary，添加自动分类 |
| `src/main/database/migrations/index.ts` | 添加 002_fix_content_types 迁移 |
| `src/renderer/src/views/FolderView.tsx` | 添加右侧预览面板 |
| `src/renderer/src/views/HomeView.tsx` | 添加右侧预览面板 + 新建文件夹按钮 |
| `src/renderer/src/views/SettingsView.tsx` | 添加自动分类配置 |
