import crypto from 'crypto'
import https from 'https'
import RssParser from 'rss-parser'
import { feedRepo } from '../database/repositories/feed.repo'
import { itemRepo } from '../database/repositories/item.repo'
import { query } from '../database/connection'
import { importFromUrl } from './import-service'
import { logger } from '../utils/logger'
import type { FeedSource, FeedItem, PresetFeedSource } from '../database/types'

const rssParser = new RssParser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBase-App/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
})

let refreshTimer: ReturnType<typeof setInterval> | null = null

interface RssFeedItem {
  title: string
  link: string
  contentSnippet: string
  author: string
  pubDate: string
  contentHash: string
}

interface GitHubTrendingItem {
  title: string
  url: string
  summary: string
  author: string
  publishedAt: string | null
  contentHash: string
  metadata: Record<string, unknown>
}

function toMySQLDateTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return null
  }
}

export async function fetchRssFeed(source: FeedSource): Promise<RssFeedItem[]> {
  try {
    const feedUrl = source.url.replace(/^http:\/\/(arxiv\.org)/, 'https://$1')
    const parsed = await rssParser.parseURL(feedUrl)
    const items: RssFeedItem[] = []

    for (const item of parsed.items) {
      const link = item.link || ''
      if (!link) continue

      const contentRaw = [
        item.title || '',
        item.contentSnippet || '',
        item.author || '',
        item.pubDate || '',
      ].join('|')

      const contentHash = crypto.createHash('sha256').update(contentRaw).digest('hex')

      items.push({
        title: item.title || 'Untitled',
        link,
        contentSnippet: item.contentSnippet || '',
        author: item.creator || item.author || '',
        pubDate: item.pubDate || item.isoDate || '',
        contentHash,
      })
    }

    logger.info(`RSS feed parsed: ${source.name}, ${items.length} items`)
    return items
  } catch (err) {
    logger.error(`Failed to fetch RSS feed from ${source.url}:`, err)
    throw err
  }
}

function fetchJson(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 30_000

    const req = https.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location
        fetchJson(redirectUrl, headers).then(resolve).catch(reject)
        return
      }

      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', (err: Error) => reject(new Error(`Response error: ${err.message}`)))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timed out after ${timeoutMs}ms for ${url}`))
    })

    req.on('error', (err: Error) => reject(new Error(`Network error: ${err.message}`)))
  })
}

export async function fetchGitHubTrending(): Promise<GitHubTrendingItem[]> {
  const url = 'https://github.com/trending?since=weekly'

  const html = await new Promise<string>((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectReq = https.get(res.headers.location, { timeout: 30000 }, (redirectRes) => {
          const chunks: Buffer[] = []
          redirectRes.on('data', (chunk: Buffer) => chunks.push(chunk))
          redirectRes.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
          redirectRes.on('error', reject)
        })
        redirectReq.on('error', reject)
        redirectReq.on('timeout', () => { redirectReq.destroy(); reject(new Error('Request timed out')) })
        return
      }
      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.on('error', reject)
  })

  const items: GitHubTrendingItem[] = []
  const articleBlocks = html.split(/<article[\s>]/i).slice(1)

  for (const block of articleBlocks) {
    const repoLinkMatches = block.matchAll(/href="\/([\w.-]+\/[\w.-]+)"/g)
    let fullName = ''
    for (const m of repoLinkMatches) {
      const candidate = m[1]
      const parts = candidate.split('/')
      if (parts.length === 2
        && !candidate.startsWith('sponsors/')
        && !candidate.startsWith('topics/')
        && !candidate.startsWith('explore/')
        && !candidate.startsWith('marketplace/')
        && !candidate.startsWith('orgs/')
        && !candidate.includes('?')
        && !candidate.includes('#')) {
        fullName = candidate
        break
      }
    }
    if (!fullName) continue

    const h2Match = block.match(/<h2[\s\S]*?<\/h2>/)
    const h2Block = h2Match ? h2Match[0] : block

    const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/)
      || block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : ''

    const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>([^<]+)/i)
      || block.match(/programmingLanguage[^>]*>([^<]+)/i)
    const language = langMatch ? langMatch[1].trim() : ''

    const starMatch = block.match(/(\d[\d,]*)\s*stars?\s/i)
      || block.match(/octicon-star[\s\S]*?(\d[\d,]*)/i)
    const starsStr = starMatch ? starMatch[1].replace(/,/g, '').trim() : '0'
    const stars = parseInt(starsStr, 10) || 0

    const repoUrl = `https://github.com/${fullName}`
    const contentRaw = [fullName, description, String(stars), language].join('|')
    const contentHash = crypto.createHash('sha256').update(contentRaw).digest('hex')

    items.push({
      title: fullName,
      url: repoUrl,
      summary: description,
      author: language,
      publishedAt: null,
      contentHash,
      metadata: {
        full_name: fullName,
        description: description || null,
        language: language || null,
        stargazers_count: stars,
        source: 'github-trending',
      },
    })
  }

  logger.info(`GitHub Trending parsed: ${items.length} repos`)
  return items
}

async function getExistingUrlsForSource(sourceId: number): Promise<Set<string>> {
  const urls = await feedRepo.findUrlsBySourceId(sourceId)
  return new Set(urls)
}

export async function refreshAllSources(): Promise<void> {
  const sources = await feedRepo.findEnabled()
  const now = new Date()

  for (const source of sources) {
    try {
      const lastFetched = source.lastFetchedAt ? new Date(source.lastFetchedAt) : null
      const intervalMs = (source.fetchIntervalMinutes || 60) * 60 * 1000

      if (lastFetched && (now.getTime() - lastFetched.getTime()) < intervalMs) {
        continue
      }

      await refreshSource(source.id)
    } catch (err) {
      logger.error(`Failed to refresh source ${source.name}:`, err)
    }
  }
}

export async function refreshSource(sourceId: number): Promise<void> {
  const source = await feedRepo.findById(sourceId)
  if (!source || !source.enabled) return

  try {
    if (source.type === 'rss') {
      const items = await fetchRssFeed(source)
      for (const item of items) {
        const existing = await feedRepo.findItemByUrl(item.link)
        if (existing) continue

        await feedRepo.createItem({
          sourceId: source.id,
          title: item.title.slice(0, 500),
          url: item.link,
          summary: (item.contentSnippet || '').slice(0, 5000),
          author: (item.author || '').slice(0, 500) || null,
          publishedAt: toMySQLDateTime(item.pubDate),
          contentHash: item.contentHash,
        })
      }
    } else if (source.type === 'github') {
      const existingUrls = await getExistingUrlsForSource(source.id)
      const items = await fetchGitHubTrending()

      for (const item of items) {
        if (existingUrls.has(item.url)) continue
        await feedRepo.createItem({
          sourceId: source.id,
          title: item.title.slice(0, 500),
          url: item.url,
          summary: (item.summary || '').slice(0, 5000),
          author: (item.author || '').slice(0, 500) || null,
          publishedAt: toMySQLDateTime(item.publishedAt),
          contentHash: item.contentHash,
          metadata: item.metadata,
        })
      }
    }

    await feedRepo.updateLastFetched(source.id)
    logger.info(`Source refreshed: ${source.name}`)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error(`Failed to refresh source ${source.name}:`, err)

    const failCount = await feedRepo.incrementFailCount(source.id, errMsg)
    if (failCount >= 3) {
      await feedRepo.update(source.id, { enabled: false })
      logger.warn(`Source auto-disabled after ${failCount} consecutive failures: ${source.name}`)
    }
  }
}

export async function importFeedItem(feedItemId: number, folderId?: number): Promise<number> {
  const feedItem = await feedRepo.findItemById(feedItemId)
  if (!feedItem) throw new Error(`Feed item not found: ${feedItemId}`)

  if (feedItem.importedItemId) return feedItem.importedItemId

  const existingRows = await query(
    'SELECT id FROM items WHERE source_url = ? LIMIT 1',
    [feedItem.url]
  ) as Array<{ id: number }>
  if (Array.isArray(existingRows) && existingRows.length > 0) {
    await feedRepo.markAsImported(feedItemId, existingRows[0].id)
    return existingRows[0].id
  }

  const meta = feedItem.metadata ? JSON.parse(feedItem.metadata) : null

  if (meta && (meta.source === 'github-trending' || meta.source === 'github-trending-weekly')) {
    const contentHtml = [
      `<h1>${meta.full_name || feedItem.title}</h1>`,
      meta.description ? `<p>${meta.description}</p>` : '',
      meta.language ? `<p><strong>Language:</strong> ${meta.language}</p>` : '',
      meta.stargazers_count ? `<p><strong>Stars:</strong> ${meta.stargazers_count}</p>` : '',
      `<p><a href="${feedItem.url}" target="_blank">View on GitHub</a></p>`,
    ].filter(Boolean).join('\n')

    const dto = {
      title: meta.full_name || feedItem.title,
      content: meta.description || feedItem.summary || '',
      contentHtml,
      summary: (meta.description || feedItem.summary || '').slice(0, 500),
      contentType: 'article' as const,
      sourceUrl: feedItem.url,
      sourceType: 'web' as const,
      sourceName: 'GitHub Trending',
      folderId: folderId ?? null,
      metadata: meta,
    }

    const itemId = await itemRepo.create(dto)
    await feedRepo.markAsImported(feedItemId, itemId)
    return itemId
  }

  const itemId = await importFromUrl(feedItem.url, folderId)
  await feedRepo.markAsImported(feedItemId, itemId)

  return itemId
}

export async function batchImportFeedItems(
  feedItemIds: number[],
  folderId?: number
): Promise<{ success: number; failed: number; results: Array<{ id: number; itemId?: number; error?: string }> }> {
  let success = 0
  let failed = 0
  const results: Array<{ id: number; itemId?: number; error?: string }> = []

  for (const id of feedItemIds) {
    try {
      const itemId = await importFeedItem(id, folderId)
      success++
      results.push({ id, itemId })
    } catch (err) {
      failed++
      results.push({ id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { success, failed, results }
}

export function startAutoRefresh(intervalMinutes: number = 60): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  refreshTimer = setInterval(() => {
    refreshAllSources().catch((err) => {
      logger.error('Auto refresh failed:', err)
    })
  }, intervalMinutes * 60 * 1000)
  logger.info(`Auto refresh started, interval: ${intervalMinutes} minutes`)
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

export function getPresetSources(): PresetFeedSource[] {
  return [
    { name: '少数派', url: 'https://sspai.com/feed', description: '少数派 - 高效工作和品质生活', siteUrl: 'https://sspai.com/', category: '中文区优质RSS源' },
    { name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/blog/atom.xml', description: '阮一峰科技爱好者周刊', siteUrl: 'https://www.ruanyifeng.com/blog/', category: '中文区优质RSS源' },
    { name: '美团技术团队', url: 'https://tech.meituan.com/feed/', description: '美团技术团队博客', siteUrl: 'https://tech.meituan.com/', category: '中文区优质RSS源' },
    { name: 'IT之家', url: 'https://www.ithome.com/rss/', description: 'IT之家 - IT 资讯', siteUrl: 'https://www.ithome.com/', category: '中文区优质RSS源' },
    { name: '知乎每日精选', url: 'https://www.zhihu.com/rss', description: '知乎每日精选', siteUrl: 'https://www.zhihu.com/', category: '中文区优质RSS源' },
    { name: '酷壳 CoolShell', url: 'http://coolshell.cn/feed', description: '酷壳 - 陈皓的技术博客', siteUrl: 'https://coolshell.cn/', category: '中文区优质RSS源' },
    { name: '奇客 Solidot', url: 'https://www.solidot.org/index.rss', description: '奇客 - 传递最新科技情报', siteUrl: 'https://www.solidot.org/', category: '中文区优质RSS源' },
    { name: '月光博客', url: 'http://www.williamlong.info/rss.xml', description: '月光博客 - IT 和互联网评论', siteUrl: 'https://www.williamlong.info/', category: '中文区优质RSS源' },
    { name: '36氪', url: 'https://36kr.com/feed', description: '36氪 - 让创业更简单', siteUrl: 'https://36kr.com/', category: '中文区优质RSS源' },
    { name: '虎嗅', url: 'https://rss.huxiu.com/', description: '虎嗅 - 商业资讯', siteUrl: 'https://www.huxiu.com/', category: '中文区优质RSS源' },
    { name: '爱范儿', url: 'https://www.ifanr.com/feed', description: '爱范儿 - 发现创新价值的科技媒体', siteUrl: 'https://www.ifanr.com/', category: '中文区优质RSS源' },
    { name: '极客公园', url: 'http://www.geekpark.net/rss', description: '极客公园 - 科技创新者社区', siteUrl: 'https://www.geekpark.net/', category: '中文区优质RSS源' },
    { name: 'V2EX', url: 'https://www.v2ex.com/index.xml', description: 'V2EX 技术社区', siteUrl: 'https://www.v2ex.com/', category: '中文区优质RSS源' },
    { name: '掘金 - 前端', url: 'https://rsshub.app/juejin/trending/frontend/monthly', description: '掘金前端月度热门', siteUrl: 'https://juejin.cn/frontend', category: '中文区优质RSS源' },
    { name: '掘金 - 后端', url: 'https://rsshub.app/juejin/trending/backend/monthly', description: '掘金后端月度热门', siteUrl: 'https://juejin.cn/backend', category: '中文区优质RSS源' },
    { name: 'HelloGitHub 月刊', url: 'https://hellogithub.com/rss', description: 'HelloGitHub 开源项目月刊', siteUrl: 'https://hellogithub.com/', category: '中文区优质RSS源' },
    { name: '张鑫旭博客', url: 'https://www.zhangxinxu.com/wordpress/feed/', description: '张鑫旭 - 鑫空间-鑫生活', siteUrl: 'https://www.zhangxinxu.com/', category: '中文区优质RSS源' },
    { name: '云风的 BLOG', url: 'http://blog.codingnow.com/atom.xml', description: '云风 - 游戏开发博客', siteUrl: 'https://blog.codingnow.com/', category: '中文区优质RSS源' },
    { name: '唐巧的博客', url: 'http://blog.devtang.com/atom.xml', description: '唐巧 - iOS 开发博客', siteUrl: 'https://blog.devtang.com/', category: '中文区优质RSS源' },
    { name: '程序员的喵', url: 'https://catcoding.me/atom.xml', description: '程序员的喵 - 编程与生活', siteUrl: 'https://catcoding.me/', category: '中文区优质RSS源' },
    { name: 'Python 工匠', url: 'https://www.zlovezl.cn/feeds/latest/', description: 'Python 工匠系列文章', siteUrl: 'https://www.zlovezl.cn/', category: '中文区优质RSS源' },
    { name: 'DIYGod', url: 'https://diygod.me/atom.xml', description: 'DIYGod - RSSHub 作者博客', siteUrl: 'https://diygod.me/', category: '中文区优质RSS源' },
    { name: '有赞技术团队', url: 'https://tech.youzan.com/rss/', description: '有赞技术团队博客', siteUrl: 'https://tech.youzan.com/', category: '中文区优质RSS源' },
    { name: '小众软件', url: 'https://www.appinn.com/feed/', description: '小众软件 - 发现新软件', siteUrl: 'https://www.appinn.com/', category: '中文区优质RSS源' },
    { name: '异次元软件世界', url: 'https://feed.iplaysoft.com', description: '异次元软件世界', siteUrl: 'https://www.iplaysoft.com/', category: '中文区优质RSS源' },
    { name: '潮流周刊', url: 'https://weekly.tw93.fun/rss.xml', description: '潮流周刊 - TW93', siteUrl: 'https://weekly.tw93.fun/', category: '中文区优质RSS源' },
    { name: 'InfoQ 推荐', url: 'https://plink.anyfeeder.com/infoq/recommend', description: 'InfoQ 推荐文章', siteUrl: 'https://www.infoq.cn/', category: '中文区优质RSS源' },
    { name: '开发者头条', url: 'https://plink.anyfeeder.com/toutiao.io', description: '开发者头条', siteUrl: 'https://toutiao.io/', category: '中文区优质RSS源' },
    { name: 'Readhub 热门话题', url: 'https://plink.anyfeeder.com/readhub/topic', description: 'Readhub 热门话题', siteUrl: 'https://readhub.cn/', category: '中文区优质RSS源' },
    { name: '码农周刊', url: 'https://rsshub.app/manong-weekly', description: '码农周刊', siteUrl: 'https://manong.io/', category: '中文区优质RSS源' },
    { name: '机核', url: 'https://www.gcores.com/rss', description: '机核 - 游戏与文化', siteUrl: 'https://www.gcores.com/', category: '中文区优质RSS源' },
    { name: '游戏研究社', url: 'https://www.yystv.cn/rss/feed', description: '游戏研究社', siteUrl: 'https://www.yystv.cn/', category: '中文区优质RSS源' },
    { name: 'Engadget 中国', url: 'https://cn.engadget.com/rss.xml', description: 'Engadget 中文版', siteUrl: 'https://cn.engadget.com/', category: '中文区优质RSS源' },
    { name: 'IT之家 24小时热榜', url: 'https://rsshub.app/ithome/ranking/24h', description: 'IT之家 24 小时最热', siteUrl: 'https://www.ithome.com/', category: '中文区优质RSS源' },
    { name: '知乎热榜', url: 'https://rsshub.app/zhihu/hotlist', description: '知乎热榜', siteUrl: 'https://www.zhihu.com/hot', category: '中文区优质RSS源' },
    { name: '微博热搜榜', url: 'https://rsshub.app/weibo/search/hot', description: '微博热搜榜', siteUrl: 'https://s.weibo.com/', category: '中文区优质RSS源' },
    { name: '澎湃新闻', url: 'https://plink.anyfeeder.com/thepaper', description: '澎湃新闻 - 首页头条', siteUrl: 'https://www.thepaper.cn/', category: '中文区优质RSS源' },
    { name: '构建我的被动收入', url: 'https://www.bmpi.dev/index.xml', description: '构建我的被动收入', siteUrl: 'https://www.bmpi.dev/', category: '中文区优质RSS源' },
    { name: "Halfrost's Field", url: 'https://halfrost.com/rss/', description: 'Halfrost - iOS/区块链技术博客', siteUrl: 'https://halfrost.com/', category: '中文区优质RSS源' },
    { name: "Xuanwo's Blog", url: 'https://xuanwo.io/index.xml', description: 'Xuanwo - 开源与分布式存储', siteUrl: 'https://xuanwo.io/', category: '中文区优质RSS源' },
    { name: 'Phodal', url: 'https://www.phodal.com/blog/feeds/rss/', description: 'Phodal - 全栈应用开发', siteUrl: 'https://www.phodal.com/', category: '中文区优质RSS源' },
  ]
}

export async function parseOpmlAndImport(opmlContent: string): Promise<{ imported: number; updated: number; skipped: number; failed: number }> {
  const result = { imported: 0, updated: 0, skipped: 0, failed: 0 }

  const xmlUrlRegex = /xmlUrl="([^"]+)"/i
  const htmlUrlRegex = /htmlUrl="([^"]+)"/i
  const textRegex = /(?:text|title)="([^"]+)"/i

  const existingSources = await feedRepo.findAll()
  const existingByUrl = new Map(existingSources.map(s => [s.url, s]))

  const lines = opmlContent.split('\n')
  let currentCategory: string | null = null

  for (const line of lines) {
    const outlineMatches = line.matchAll(/<outline[^>]*>/gi)
    for (const match of outlineMatches) {
      const outlineTag = match[0]

      const xmlUrlMatch = outlineTag.match(xmlUrlRegex)
      const textMatch = outlineTag.match(textRegex)
      const name = textMatch ? textMatch[1] : ''

      if (!xmlUrlMatch) {
        if (name) {
          currentCategory = name.replace(/^[\p{Emoji_Presentation}\s]+/u, '').trim() || null
        }
        continue
      }

      const xmlUrl = xmlUrlMatch[1]
      const htmlUrlMatch = outlineTag.match(htmlUrlRegex)
      const sourceName = name || xmlUrl
      const siteUrl = htmlUrlMatch ? htmlUrlMatch[1] : null

      const existing = existingByUrl.get(xmlUrl)
      if (existing) {
        if (currentCategory && !existing.category) {
          try {
            await feedRepo.update(existing.id, { category: currentCategory })
            result.updated++
          } catch (err) {
            logger.error(`Failed to update category for: ${xmlUrl}`, err)
          }
        } else {
          result.skipped++
        }
        continue
      }

      try {
        await feedRepo.create({
          name: sourceName,
          url: xmlUrl,
          type: 'rss',
          siteUrl,
          category: currentCategory,
        })
        result.imported++
        existingByUrl.set(xmlUrl, { id: -1, url: xmlUrl, category: currentCategory } as any)
      } catch (err) {
        logger.error(`Failed to import OPML source: ${xmlUrl}`, err)
        result.failed++
      }
    }
  }

  logger.info(`OPML import: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`)
  return result
}
