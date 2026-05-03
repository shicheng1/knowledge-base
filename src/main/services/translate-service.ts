import https from 'https'
import { feedRepo } from '../database/repositories/feed.repo'
import { logger } from '../utils/logger'

export async function translateText(text: string, from: string = 'en', to: string = 'zh-CN'): Promise<string> {
  if (!text || !text.trim()) return text

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        translateText(text, from, to).then(resolve).catch(reject)
        return
      }
      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`Translation API returned HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8')
          const parsed = JSON.parse(body)
          if (parsed.responseStatus === 200 && parsed.responseData?.translatedText) {
            resolve(parsed.responseData.translatedText)
          } else {
            reject(new Error(parsed.responseDetails || 'Translation failed'))
          }
        } catch (err) {
          reject(err)
        }
      })
      res.on('error', (err: Error) => reject(err))
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Translation request timed out'))
    })
    req.on('error', (err: Error) => reject(err))
  })
}

export async function translateFeedItem(feedItemId: number): Promise<{ title: string; summary: string }> {
  const feedItem = await feedRepo.findItemById(feedItemId)
  if (!feedItem) throw new Error(`Feed item not found: ${feedItemId}`)

  let existingMeta: Record<string, unknown> = {}
  if (feedItem.metadata) {
    try {
      existingMeta = typeof feedItem.metadata === 'string' ? JSON.parse(feedItem.metadata) : feedItem.metadata
    } catch { existingMeta = {} }
  }

  if (existingMeta.translated_title) {
    return {
      title: existingMeta.translated_title as string,
      summary: (existingMeta.translated_summary as string) || feedItem.summary || '',
    }
  }

  let translatedTitle = feedItem.title
  let translatedSummary = feedItem.summary || ''

  try {
    if (feedItem.title) {
      translatedTitle = await translateText(feedItem.title)
    }
  } catch (err) {
    logger.error('Failed to translate title:', err)
  }

  try {
    if (feedItem.summary) {
      translatedSummary = await translateText(feedItem.summary)
    }
  } catch (err) {
    logger.error('Failed to translate summary:', err)
  }

  const newMeta = {
    ...existingMeta,
    translated_title: translatedTitle,
    translated_summary: translatedSummary,
  }

  await feedRepo.updateItemMetadata(feedItemId, newMeta)

  return { title: translatedTitle, summary: translatedSummary }
}
