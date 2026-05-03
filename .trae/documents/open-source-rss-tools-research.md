# 开源 RSS 工具调研与借鉴方案

## 调研结果

### 一、与本项目技术栈最接近（Electron + React）

| 项目 | Stars | 技术栈 | 借鉴价值 |
|---|---|---|---|
| **Fluent Reader** | 7k+ | Electron + React + TypeScript | ⭐⭐⭐⭐⭐ 最接近，UI 精美，支持 Fever API 同步、OPML、阅读模式 |
| **Fluent Reader Lite** | 1k+ | React Native | 移动端参考 |
| **Raven Reader** | 2.5k+ | Electron + Vue.js | 多 API 对接（Feedbin/Inoreader/Fever） |

### 二、AI 增强型（最前沿方向）

| 项目 | Stars | 技术栈 | 借鉴价值 |
|---|---|---|---|
| **MrRSS** | 2.1k+ | Go + Wails | ⭐⭐⭐⭐⭐ 自动翻译、AI 摘要、智能订阅源发现、过滤规则 |
| **zenfeed** | 1.7k+ | Go | ⭐⭐⭐⭐ AI 驱动的 RSS 聚合，支持 MCP/DeepSeek/OpenAI |
| **Glance** | 33k+ | Go | ⭐⭐⭐⭐ 自托管仪表盘，聚合 RSS/Reddit/YouTube，极简高效 |

### 三、自托管服务端（功能最完整）

| 项目 | Stars | 技术栈 | 借鉴价值 |
|---|---|---|---|
| **FreshRSS** | 10k+ | PHP + MySQL | ⭐⭐⭐⭐ 多用户、插件系统、API 同步、扩展丰富 |
| **Miniflux** | 6k+ | Go + PostgreSQL | ⭐⭐⭐⭐ 极简设计、Fever API、PWA、代码质量高 |
| **Tiny Tiny RSS** | 800+ | PHP + MySQL | ⭐⭐⭐ 老牌方案，插件丰富，但代码较旧 |

### 四、移动端（UI/UX 参考）

| 项目 | Stars | 技术栈 | 借鉴价值 |
|---|---|---|---|
| **ReadYou** | 5k+ | Kotlin (Android) | ⭐⭐⭐⭐ Material Design，现代 UI，分类阅读 |
| **NetNewsWire** | 8k+ | Swift (iOS/macOS) | ⭐⭐⭐⭐ 简洁高效，iCloud 同步，阅读体验极佳 |
| **Feeder** | 1k+ | Kotlin (Android) | ⭐⭐⭐ 简洁无赘余，离线阅读 |

### 五、RSS 生态工具

| 项目 | Stars | 用途 | 借鉴价值 |
|---|---|---|---|
| **RSSHub** | 35k+ | Node.js | ⭐⭐⭐⭐⭐ 万物皆可 RSS，路由化设计，插件式扩展 |
| **RSSHub Radar** | 1k+ | 浏览器扩展 | 自动发现当前网站的 RSS 订阅地址 |

---

## 可借鉴的核心功能

### 从 Fluent Reader 借鉴
1. **三栏布局**：源列表 → 文章列表 → 阅读区，经典 RSS 阅读器布局
2. **阅读模式**：提取正文内容，去除广告和无关元素
3. **Fever API 兼容**：支持与第三方服务同步
4. **文章搜索**：全文搜索已缓存的文章
5. **主题系统**：亮色/暗色/跟随系统

### 从 MrRSS 借鉴
1. **自动翻译**：使用免费翻译 API 或 AI 服务，类似沉浸式翻译
2. **AI 摘要**：使用本地算法或 AI 生成文章摘要
3. **智能订阅源发现**：从友链和相关来源发现新源
4. **智能过滤规则**：正则表达式匹配，自动分类/标记/归档
5. **自动化脚本**：支持用户自定义脚本获取订阅源

### 从 Glance 借鉴
1. **仪表盘布局**：卡片式展示多个订阅源
2. **多源聚合**：RSS + Reddit + YouTube + Hacker News 等
3. **极简配置**：YAML 配置文件，一目了然

### 从 FreshRSS/Miniflux 借鉴
1. **Fever API 兼容**：标准 API 接口，支持第三方客户端
2. **多用户支持**：权限管理、独立配置
3. **插件/扩展系统**：可扩展架构
4. **定时抓取**：Cron 式调度，可配置抓取频率

### 从 RSSHub 借鉴
1. **路由化设计**：每个网站一个路由，插件式扩展
2. **社区贡献**：开源路由，用户可提交新路由
3. **缓存策略**：合理的缓存机制，避免频繁请求

---

## 建议优先实现的功能（按优先级排序）

### P0 - 核心体验
1. **阅读模式**：提取正文，去除广告（当前已有 webview 预览，可增强）
2. **全文搜索**：搜索已缓存的文章标题和摘要
3. **文章收藏/稍后读**：标记重要文章

### P1 - 效率提升
4. **智能过滤规则**：关键词过滤、自动分类、正则匹配
5. **AI 摘要/翻译**：集成 AI API 生成摘要和翻译（当前已有翻译功能）
6. **订阅源发现**：输入网站 URL 自动发现 RSS 地址

### P2 - 生态扩展
7. **Fever API 兼容**：支持第三方客户端同步
8. **RSSHub 集成**：内置 RSSHub 路由，扩展订阅能力
9. **浏览器扩展**：一键订阅当前网站的 RSS

---

## 关键仓库链接

- Fluent Reader: https://github.com/yang991178/fluent-reader
- MrRSS: https://github.com/WCY-dt/MrRSS
- Glance: https://github.com/glanceapp/glance
- zenfeed: https://github.com/glidea/zenfeed
- FreshRSS: https://github.com/FreshRSS/FreshRSS
- Miniflux: https://github.com/miniflux/v2
- NetNewsWire: https://github.com/Ranchero-Software/NetNewsWire
- ReadYou: https://github.com/Ashinch/ReadYou
- RSSHub: https://github.com/DIYgod/RSSHub
- RSSHub Radar: https://github.com/DIYgod/RSSHub-Radar
