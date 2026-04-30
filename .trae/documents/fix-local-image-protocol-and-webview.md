# 修复 local-image:// 协议和 webview 问题

## 问题分析

### 问题 1：local-image:// 图片预览破碎

**根因**：URL 格式解析错误。

当前 `local-image://` URL 格式为：`local-image://E:/03-knowleage/editor-images/42/xxx.png`

浏览器解析自定义协议 URL 时，`E:` 会被当作 **hostname**（主机名），而不是文件路径的一部分。实际传递给 `protocol.handle` 的 `request.url` 可能被浏览器规范化为 `local-image://e/03-knowleage/editor-images/42/xxx.png`，导致提取的文件路径不正确。

**修复方案**：改用 `local-image:///E:/03-knowleage/...` 格式（三个斜杠），这样 `E:` 就是路径的一部分而非主机名。同时修改协议处理器，正确解析三斜杠格式的 URL。

具体修改：
1. `editor-image.service.ts` — 返回路径改为 `local-image:///E:/path/...`（三斜杠）
2. `native-messaging.ts` — 图片 URL 改为三斜杠格式
3. `ItemDetailView.tsx` — 图片引用改为三斜杠格式
4. `index.ts` — 协议处理器正确解析三斜杠 URL，去除开头的 `/`

### 问题 2：webview 打不开微信公众号文章

**根因**：Electron webview 在 `webSecurity: true` 模式下，受 CSP 和安全策略限制，无法加载外部网页。同时 webview 需要额外的 `partition` 配置来确保正常的网络请求。

**修复方案**：
1. 为 webview 添加 `partition` 属性，使用独立的 session 绕过主窗口的安全限制
2. 在 `will-navigate` 事件中放行 webview 的导航请求
3. 确保 webview 的 `allowpopups` 和 `useragent` 配置正确

## 修改文件

1. `src/main/index.ts` — 修复 local-image:// 协议处理器的 URL 解析
2. `src/main/services/editor-image.service.ts` — 三斜杠格式
3. `src/main/services/native-messaging.ts` — 三斜杠格式
4. `src/renderer/src/views/ItemDetailView.tsx` — 三斜杠格式 + webview 配置
5. `src/main/window.ts` — webview session 配置

## 实施步骤

1. 修复 local-image:// 协议 URL 格式（三斜杠）
2. 修复协议处理器的 URL 解析逻辑
3. 修复 webview 配置
4. 构建验证
