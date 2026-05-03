# Tasks

- [x] Task 1: 修复 OPML 导入结果解析 bug + 支持分类提取
  - [x] SubTask 1.1: 修复 `FeedView.tsx` 中 `handleOpmlFileChange` 的结果解析逻辑，不再误判 `success` 字段为 IPC 包装层
  - [x] SubTask 1.2: 修改 `feed-service.ts` 的 `parseOpmlAndImport`，追踪父级 outline 的 text 属性作为分类，赋值给子级源的 category

- [x] Task 2: 调整知识源管理布局
  - [x] SubTask 2.1: 将"预置 AI 订阅源"区域从顶部移到源列表下方，OPML 导入按钮保持在顶部不变

- [x] Task 3: 文章预览新增回到顶部按钮
  - [x] SubTask 3.1: 在 webview 预览顶部工具栏新增"回到顶部"按钮，点击后通过 webview executeJavaScript 执行 window.scrollTo(0,0)

# Task Dependencies
- 三个 Task 相互独立，可并行
