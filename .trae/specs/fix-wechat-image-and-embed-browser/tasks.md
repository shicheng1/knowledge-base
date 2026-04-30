# Tasks

- [x] Task 1: Chrome 扩展 background.js 新增 fetchImage 消息处理
  - [x] 1.1: 在 background.js 中添加 `fetchImage` 消息监听，使用 fetch + Referer 头下载图片并转为 base64 DataURL
  - [x] 1.2: 在 content.js 中修改微信图片提取逻辑，对微信图片通过 background.js 代理获取 base64，放入 images 数组的 dataUrl 字段
  - [x] 1.3: 更新 NativeMessage 接口类型，images 数组新增可选 `dataUrl` 字段

- [x] Task 2: 桌面应用处理 base64 图片数据
  - [x] 2.1: 在 image-downloader.ts 中新增 `saveBase64Image` 函数，将 base64 DataURL 解码保存为本地文件
  - [x] 2.2: 修改 native-messaging.ts 的 handleSavePage，优先使用 dataUrl 保存图片，无 dataUrl 时回退到后端直接下载
  - [x] 2.3: 移除 content-extractor.ts 中之前添加的微信 data-src → src 预处理（图片现在由扩展代理下载）

- [x] Task 3: 注册 Electron 自定义协议 local-image://
  - [x] 3.1: 在 main/index.ts 中使用 `protocol.handle` 注册 `local-image` 协议，读取本地文件并返回
  - [x] 3.2: 修改 editor-image.service.ts 的 saveImageBuffer 和 selectImageFile，返回 `local-image://` 协议路径替代 `file://`
  - [x] 3.3: 修改 native-messaging.ts 中图片路径替换逻辑，使用 `local-image://` 协议
  - [x] 3.4: 修改 MarkdownEditor.tsx 中图片插入逻辑，使用 `local-image://` 协议
  - [x] 3.5: 修改 ItemDetailView.tsx 中图片预览逻辑，使用 `local-image://` 协议

- [x] Task 4: 内嵌浏览器查看公众号文章
  - [x] 4.1: 在 ItemDetailView.tsx 非编辑模式操作栏中添加"浏览原文"按钮（仅当 source_url 存在时显示）
  - [x] 4.2: 添加 webview 组件和展开/收起状态管理
  - [x] 4.3: 在 window.ts 中配置 webview 的 webPreferences（允许 webview 标签）
  - [x] 4.4: 添加内嵌浏览器区域的样式

- [x] Task 5: 更新 CHANGELOG.md
  - [x] 5.1: 在 CHANGELOG.md 顶部添加 v1.2.2 版本记录，包含所有修改内容

- [x] Task 6: 构建验证
  - [x] 6.1: 运行 `npm run build` 确保无编译错误

# Task Dependencies
- [Task 2] depends on [Task 1] (需要扩展先提供 base64 数据)
- [Task 3] depends on nothing (可独立进行)
- [Task 4] depends on nothing (可独立进行)
- [Task 5] depends on [Task 1, 2, 3, 4]
- [Task 6] depends on [Task 1, 2, 3, 4, 5]
