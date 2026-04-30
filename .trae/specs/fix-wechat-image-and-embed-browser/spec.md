# 微信公众号图片修复与内嵌浏览器 Spec

## Why
微信公众号文章图片有防盗链机制（Referer 校验），导致后端直接下载图片时返回防盗链提示图而非真实图片。同时，Markdown 编辑器预览中 `file://` 协议图片因 Electron 安全策略无法渲染，显示为小图标。用户需要一个内嵌浏览器来直接浏览公众号原文，绕过图片防盗链问题。

## What Changes
- Chrome 扩展 background.js 新增 `fetchImage` 消息处理，在浏览器上下文中代理下载微信图片并转为 base64 DataURL，绕过防盗链
- Chrome 扩展 content.js 在提取微信图片时，通过 background.js 代理获取图片 base64，随页面内容一起发送给桌面应用
- 桌面应用 native-messaging.ts 接收 base64 图片数据，保存为本地文件，HTML 中引用本地路径
- 注册 Electron 自定义协议（如 `local-image://`），替代 `file://` 协议加载本地图片，解决 Markdown 预览中图片无法显示的问题
- ItemDetailView 详情页新增"在浏览器中查看"按钮，使用 Electron `<webview>` 标签内嵌浏览器打开公众号文章原始 URL
- 将修改记录写入 CHANGELOG.md 作为 v1.2.2 版本

## Impact
- Affected specs: 图片下载流程、Chrome 扩展通信协议、Markdown 预览渲染、条目详情页
- Affected code:
  - `extension/background.js` — 新增 `fetchImage` 消息处理
  - `extension/content.js` — 微信图片提取改为 base64 模式
  - `extension/manifest.json` — 可能需要调整 host_permissions
  - `src/main/services/native-messaging.ts` — 处理 base64 图片数据
  - `src/main/services/image-downloader.ts` — 新增 base64 保存方法
  - `src/main/index.ts` — 注册自定义协议
  - `src/renderer/src/components/editor/MarkdownEditor.tsx` — 图片 src 使用自定义协议
  - `src/renderer/src/views/ItemDetailView.tsx` — 新增内嵌浏览器按钮和 webview
  - `CHANGELOG.md` — 新增 v1.2.2 版本记录

## ADDED Requirements

### Requirement: Chrome 扩展代理下载微信图片
Chrome 扩展 SHALL 在 background script 中提供图片代理下载功能，绕过微信防盗链。

#### Scenario: 提取微信文章图片
- **WHEN** content.js 检测到微信公众号文章
- **THEN** content.js 向 background.js 发送 `fetchImage` 消息，包含图片 URL
- **AND** background.js 使用 `fetch` 请求图片，设置 `Referer: https://mp.weixin.qq.com/`
- **AND** background.js 将图片转为 base64 DataURL 返回给 content.js
- **AND** content.js 将 base64 数据放入 `images` 数组的 `dataUrl` 字段

#### Scenario: 非微信文章图片
- **WHEN** content.js 提取非微信文章图片
- **THEN** 保留原始 URL，不进行代理下载（`dataUrl` 字段为空）

### Requirement: 桌面应用处理 base64 图片
桌面应用 SHALL 支持接收和保存 Chrome 扩展发送的 base64 图片数据。

#### Scenario: 接收 base64 图片
- **WHEN** native-messaging.ts 收到包含 `dataUrl` 字段的图片数据
- **THEN** 将 base64 数据解码保存为本地文件
- **AND** HTML 中替换原始 src 为本地文件路径（使用自定义协议）

#### Scenario: base64 图片保存失败
- **WHEN** base64 解码或文件写入失败
- **THEN** 记录警告日志，继续处理其他图片，不阻断保存流程

### Requirement: Electron 自定义协议加载本地图片
系统 SHALL 注册自定义协议（`local-image://`）用于加载本地图片文件，替代 `file://` 协议。

#### Scenario: Markdown 预览中显示本地图片
- **WHEN** Markdown 内容中包含 `local-image://` 协议的图片路径
- **THEN** ReactMarkdown 渲染时正确加载并显示图片
- **AND** 图片以完整尺寸显示，不是小图标

#### Scenario: TipTap 编辑器中显示本地图片
- **WHEN** TipTap 编辑器内容中包含 `local-image://` 协议的图片路径
- **THEN** 图片正确加载显示

#### Scenario: HTML 内容中引用本地图片
- **WHEN** 条目的 content_html 中包含 `local-image://` 协议的图片路径
- **THEN** 图片正确加载显示

### Requirement: 内嵌浏览器查看公众号文章
系统 SHALL 在条目详情页提供内嵌浏览器功能，用于直接浏览公众号文章原文。

#### Scenario: 有 source_url 的条目显示浏览按钮
- **WHEN** 用户查看一个有 `source_url` 的条目（特别是公众号文章）
- **THEN** 详情页操作栏显示"浏览原文"按钮

#### Scenario: 点击浏览原文按钮
- **WHEN** 用户点击"浏览原文"按钮
- **THEN** 在详情页下方展开内嵌浏览器区域，加载文章原始 URL
- **AND** 内嵌浏览器可以正常显示图片（因为 webview 有独立的 Referer 策略）

#### Scenario: 关闭内嵌浏览器
- **WHEN** 用户点击关闭按钮
- **THEN** 内嵌浏览器区域收起，恢复原始详情页布局

## MODIFIED Requirements

### Requirement: 图片下载与替换流程
原流程：content.js 提取图片 URL → native-messaging.ts 后端直接下载图片 → 替换 HTML 中的 src。

修改为：content.js 通过 background.js 代理下载微信图片获取 base64 → native-messaging.ts 接收 base64 数据保存为本地文件 → 替换 HTML 中的 src 为 `local-image://` 协议路径。

修改要点：
1. Chrome 扩展 images 数组新增 `dataUrl` 字段（可选，仅微信图片有值）
2. native-messaging.ts 优先使用 `dataUrl` 保存图片，无 `dataUrl` 时回退到后端直接下载
3. 所有本地图片路径统一使用 `local-image://` 协议

### Requirement: Markdown 编辑器图片引用
原实现：图片保存后返回 `file://` 协议路径。

修改为：图片保存后返回 `local-image://` 协议路径，确保在 Electron 渲染进程中可正确加载。

## REMOVED Requirements

### Requirement: 后端直接下载微信图片
**Reason**: 微信图片有 Referer 防盗链，后端直接下载会返回防盗链提示图。改用 Chrome 扩展在浏览器上下文中代理下载。
**Migration**: native-messaging.ts 中微信图片的下载逻辑改为接收 base64 数据保存。
