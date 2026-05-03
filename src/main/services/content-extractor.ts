import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import { processImagesAndReplaceHtml } from './image-downloader'

export interface ExtractedContent {
  title: string
  content: string        // Markdown
  contentHtml: string    // Cleaned HTML
  summary: string
  author: string | null
  siteName: string | null
  publishDate: string | null
  topImage: string | null
}

/**
 * Extract structured content from raw HTML using Readability + Turndown.
 * Returns partial results if Readability parsing fails.
 */
export async function extractFromHtml(
  html: string,
  url: string
): Promise<ExtractedContent> {
  const dom = new JSDOM(html, { url })
  const document = dom.window.document

  // Attempt Readability parsing
  const reader = new Readability(document)
  let article: ReturnType<typeof reader.parse> | null = null

  try {
    article = reader.parse()
  } catch (err) {
    console.warn('[ContentExtractor] Readability parsing failed, falling back to raw content:', err)
  }

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  })

  if (article) {
    const normalizedHtml = await normalizeHtmlImages(article.content, url)
    const markdown = turndown.turndown(normalizedHtml)

    // Generate a simple summary from the first 200 chars of plain text
    const tempDiv = dom.window.document.createElement('div')
    tempDiv.innerHTML = normalizedHtml
    const plainText = tempDiv.textContent || ''
    const summary = plainText.trim().slice(0, 200).replace(/\s+/g, ' ') + (plainText.length > 200 ? '...' : '')

    return {
      title: article.title || document.title || 'Untitled',
      content: markdown,
      contentHtml: normalizedHtml,
      summary,
      author: article.byline || null,
      siteName: article.siteName || null,
      publishDate: article.publishedTime || null,
      topImage: (article as any).topImage || null,
    }
  }

  // Fallback: extract what we can from the raw document
  const title = document.title || 'Untitled'
  const metaDesc = document.querySelector('meta[name="description"]')
  const summary = metaDesc?.getAttribute('content') || ''

  const body = document.body
  const rawHtml = body ? body.innerHTML : ''
  const normalizedHtml = await normalizeHtmlImages(rawHtml, url)
  const markdown = turndown.turndown(normalizedHtml)

  const authorMeta = document.querySelector('meta[name="author"]')
  const ogSiteName = document.querySelector('meta[property="og:site_name"]')
  const articlePublished = document.querySelector('meta[property="article:published_time"]')
  const ogImage = document.querySelector('meta[property="og:image"]')

  return {
    title,
    content: markdown,
    contentHtml: normalizedHtml,
    summary,
    author: authorMeta?.getAttribute('content') || null,
    siteName: ogSiteName?.getAttribute('content') || null,
    publishDate: articlePublished?.getAttribute('content') || null,
    topImage: ogImage?.getAttribute('content') || null,
  }
}

/**
 * Fetch HTML from a URL and extract structured content.
 * Handles redirects, encoding detection, timeouts, and network errors.
 */
export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  const parsedUrl = new URL(url)
  const client = parsedUrl.protocol === 'https:' ? https : http

  const html = await fetchUrlContent(url, client)

  return extractFromHtml(html, url)
}

/**
 * Fetch raw HTML string from a URL with redirect handling and timeout.
 */
function fetchUrlContent(
  url: string,
  client: typeof https | typeof http
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 30_000
    const maxRedirects = 5
    let redirectCount = 0

    const makeRequest = (currentUrl: string, currentClient?: typeof https | typeof http) => {
      const activeClient = currentClient || client
      const req = activeClient.get(currentUrl, {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      }, (res) => {
        // Handle redirects
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          redirectCount++
          if (redirectCount > maxRedirects) {
            reject(new Error(`Too many redirects (>${maxRedirects}) for ${url}`))
            return
          }

          let redirectUrl: string
          try {
            redirectUrl = new URL(res.headers.location, currentUrl).href
          } catch {
            reject(new Error(`Invalid redirect URL: ${res.headers.location}`))
            return
          }

          // Switch client if protocol changes (http -> https or vice versa)
          const redirectParsed = new URL(redirectUrl)
          const redirectClient = redirectParsed.protocol === 'https:' ? https : http
          makeRequest(redirectUrl, redirectClient)
          return
        }

        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }

        // Detect encoding from Content-Type or meta tags
        const contentType = res.headers['content-type'] || ''
        const charsetMatch = contentType.match(/charset=([^\s;]+)/i)
        const encoding = charsetMatch ? charsetMatch[1] : 'utf-8'

        // Collect body chunks
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })

        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks)

          // If the encoding is not utf-8, try to decode with iconv-lite if available
          if (encoding.toLowerCase() !== 'utf-8') {
            try {
              // Dynamic import to avoid hard dependency
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const iconv = require('iconv-lite')
              resolve(iconv.decode(rawBuffer, encoding))
              return
            } catch {
              // iconv-lite not available, fall back to utf-8
              console.warn(
                `[ContentExtractor] iconv-lite not available, falling back to utf-8 for encoding ${encoding}`
              )
            }
          }

          resolve(rawBuffer.toString('utf-8'))
        })

        res.on('error', (err: Error) => {
          reject(new Error(`Response error for ${url}: ${err.message}`))
        })
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request timed out after ${timeoutMs}ms for ${url}`))
      })

      req.on('error', (err: Error) => {
        reject(new Error(`Network error fetching ${url}: ${err.message}`))
      })
    }

    makeRequest(url)
  })
}

interface NormalizedImageInfo {
  src: string
  alt?: string
  variants?: string[]
}

async function normalizeHtmlImages(html: string, pageUrl: string): Promise<string> {
  if (!html.trim()) return html

  const dom = new JSDOM(`<body>${html}</body>`)
  const imgs = Array.from(dom.window.document.querySelectorAll('img'))
  if (imgs.length === 0) return html

  const imageInfos: NormalizedImageInfo[] = []
  for (const img of imgs) {
    const src = normalizeImageSrc(img, pageUrl)
    if (!src) continue

    img.setAttribute('src', src)
    img.removeAttribute('srcset')
    img.removeAttribute('data-src')

    imageInfos.push({
      src,
      alt: img.getAttribute('alt') || undefined,
      variants: [src],
    })
  }

  const isWechat = /mp\.weixin\.qq\.com/i.test(pageUrl) || /qpic\.cn|mmbiz\.qpic\.cn/i.test(dom.serialize())
  const processed = await processImagesAndReplaceHtml(
    dom.window.document.body.innerHTML,
    imageInfos,
    pageUrl,
    isWechat
  )

  if (!/<html[\s>]/i.test(processed)) return processed
  const out = new JSDOM(processed)
  return out.window.document.body.innerHTML || processed
}

function normalizeImageSrc(img: Element, pageUrl: string): string | null {
  const candidate =
    img.getAttribute('data-src') ||
    img.getAttribute('data-original') ||
    img.getAttribute('data-original-src') ||
    img.getAttribute('src')

  if (!candidate) return null
  const trimmed = candidate.trim()
  if (!trimmed) return null

  if (/^data:/i.test(trimmed)) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`

  try {
    return new URL(trimmed, pageUrl).href
  } catch {
    return trimmed
  }
}
