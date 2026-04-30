import fs from 'fs/promises'
import path from 'path'
import { extractFromHtml, extractFromUrl } from './content-extractor'
import { itemRepo } from '../database/repositories/item.repo'
import { tagRepo } from '../database/repositories/tag.repo'
import { getStorageRootPath } from '../utils/config'
import type { CreateItemDTO, ContentType } from '../database/types'

const DOCUMENT_EXTENSIONS = new Set([
  '.md', '.txt', '.html', '.htm', '.json', '.xml', '.csv',
  '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.go',
  '.rs', '.sh', '.bat', '.ps1', '.sql', '.yaml', '.yml', '.toml',
  '.css', '.scss', '.less',
])

const DOCUMENT_MIME_PREFIXES = [
  'text/',
  'application/json',
  'application/xml',
]

const FILE_CONTENT_TYPE_EXTENSIONS: Record<string, ContentType> = {
  '.pdf': 'file', '.doc': 'file', '.docx': 'file',
  '.xls': 'file', '.xlsx': 'file', '.ppt': 'file', '.pptx': 'file',
  '.txt': 'note', '.md': 'note', '.csv': 'file',
  '.html': 'article', '.htm': 'article',
  '.json': 'code', '.xml': 'code',
  '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code',
  '.c': 'code', '.cpp': 'code', '.h': 'code', '.go': 'code',
  '.rs': 'code', '.sh': 'code', '.bat': 'code', '.ps1': 'code',
  '.sql': 'code', '.yaml': 'code', '.yml': 'code', '.toml': 'code',
  '.css': 'code', '.scss': 'code', '.less': 'code',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image',
  '.gif': 'image', '.bmp': 'image', '.svg': 'image', '.webp': 'image',
}

function isDocumentFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return DOCUMENT_EXTENSIONS.has(ext)
}

function isDocumentMime(mimeType: string): boolean {
  return DOCUMENT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
}

function getContentTypeForFile(ext: string): ContentType {
  return FILE_CONTENT_TYPE_EXTENSIONS[ext] ?? 'other'
}

export async function importFromUrl(
  url: string,
  folderId?: number,
  tagIds?: number[]
): Promise<number> {
  const extracted = await extractFromUrl(url)

  const dto: CreateItemDTO = {
    title: extracted.title,
    content: extracted.content,
    contentHtml: extracted.contentHtml,
    summary: extracted.summary,
    contentType: 'article',
    sourceUrl: url,
    sourceType: 'web',
    sourceName: extracted.siteName ?? null,
    folderId: folderId ?? null,
    tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
    metadata: {
      author: extracted.author,
      publishDate: extracted.publishDate,
      topImage: extracted.topImage,
    },
  }

  const itemId = await itemRepo.create(dto)
  return itemId
}

export async function importFromFile(
  filePath: string,
  folderId?: number
): Promise<number> {
  const stat = await fs.stat(filePath).catch(() => null)
  
  if (!stat || !stat.isFile()) {
    throw new Error(`File not found or is not a regular file: ${filePath}`)
  }

  const fileName = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const contentType = getContentTypeForFile(ext)
  
  if (isDocumentFile(filePath)) {
    const rawContent = await fs.readFile(filePath, 'utf-8')

    let title = fileName
    let content = rawContent
    let contentHtml = ''
    let summary = ''
    let metadata: Record<string, unknown> = {}

    if (ext === '.html' || ext === '.htm') {
      const extracted = await extractFromHtml(rawContent, `file://${filePath}`)
      title = extracted.title
      content = extracted.content
      contentHtml = extracted.contentHtml
      summary = extracted.summary
      metadata = {
        author: extracted.author,
        siteName: extracted.siteName,
        publishDate: extracted.publishDate,
        topImage: extracted.topImage,
      }
    } else if (ext === '.md' || ext === '.txt') {
      title = fileName.replace(/\.[^.]+$/, '')
      summary = rawContent.trim().slice(0, 200).replace(/\s+/g, ' ') +
        (rawContent.length > 200 ? '...' : '')
      contentHtml = `<pre>${rawContent}</pre>`
    } else {
      // 代码文件和其他文本文件
      title = fileName.replace(/\.[^.]+$/, '')
      summary = rawContent.trim().slice(0, 200).replace(/\s+/g, ' ') +
        (rawContent.length > 200 ? '...' : '')
      contentHtml = `<pre><code class="language-${ext.slice(1)}">${escapeHtml(rawContent)}</code></pre>`
    }

    const dto: CreateItemDTO = {
      title,
      content,
      contentHtml,
      summary,
      contentType,
      sourceUrl: `file://${filePath}`,
      sourceType: 'file',
      sourceName: fileName,
      fileSize: stat.size,
      folderId: folderId ?? null,
      metadata,
    }

    const itemId = await itemRepo.create(dto)
    return itemId
  }

  const storageDir = getStorageRootPath()
  
  await fs.mkdir(storageDir, { recursive: true })

  let targetPath = path.join(storageDir, fileName)
  try {
    await fs.access(targetPath)
    const baseName = path.basename(fileName, ext)
    const timestamp = Date.now()
    targetPath = path.join(storageDir, `${baseName}_${timestamp}${ext}`)
  } catch {
    // file does not exist, use original name
  }

  await fs.copyFile(filePath, targetPath)

  const dto: CreateItemDTO = {
    title: fileName.replace(/\.[^.]+$/, ''),
    content: '',
    contentHtml: '',
    summary: `文件附件: ${fileName} (${formatFileSize(stat.size)})`,
    contentType,
    sourceUrl: `file://${filePath}`,
    sourceType: 'file',
    sourceName: fileName,
    filePath: targetPath,
    fileSize: stat.size,
    folderId: folderId ?? null,
  }

  const itemId = await itemRepo.create(dto)
  return itemId
}

export async function importFromHtml(
  html: string,
  url: string,
  folderId?: number,
  tagNames?: string[]
): Promise<number> {
  const extracted = await extractFromHtml(html, url)

  const dto: CreateItemDTO = {
    title: extracted.title,
    content: extracted.content,
    contentHtml: extracted.contentHtml,
    summary: extracted.summary,
    contentType: 'article',
    sourceUrl: url,
    sourceType: 'web',
    sourceName: extracted.siteName ?? null,
    folderId: folderId ?? null,
    metadata: {
      author: extracted.author,
      publishDate: extracted.publishDate,
      topImage: extracted.topImage,
    },
  }

  const itemId = await itemRepo.create(dto)

  if (tagNames && tagNames.length > 0) {
    const tagIds: number[] = []
    for (const name of tagNames) {
      const existing = await tagRepo.findByName(name)
      if (existing) {
        tagIds.push(existing.id)
      } else {
        const newId = await tagRepo.create(name)
        tagIds.push(newId)
      }
    }
    await tagRepo.setForItem(itemId, tagIds)
  }

  return itemId
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
