import http from 'http'
import { URL } from 'url'
import { tagRepo } from '../database/repositories/tag.repo'
import { folderRepo } from '../database/repositories/folder.repo'
import { importFromHtml } from '../services/import-service'
import { archiveFullPage } from '../services/full-archiver.service'
import { itemRepo } from '../database/repositories/item.repo'
import { processImagesAndReplaceHtml } from '../services/image-downloader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavePageRequest {
  url: string
  title: string
  html: string
  folderId?: number
  tags?: string[]
  isWechat?: boolean
  images?: Array<{ src: string; alt?: string; dataUrl?: string; variants?: string[] }>
}

interface ApiResponse {
  status: 'ok' | 'error'
  data?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 17321

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * Parse the JSON body from an HTTP request.
 */
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err}`))
      }
    })

    req.on('error', (err: Error) => {
      reject(new Error(`Request body read error: ${err.message}`))
    })
  })
}

/**
 * Set CORS headers for localhost access.
 */
function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

/**
 * Send a JSON response.
 */
function sendJson(res: http.ServerResponse, statusCode: number, body: ApiResponse): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleSavePage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req) as SavePageRequest

    if (!body.url || !body.html) {
      sendJson(res, 400, {
        status: 'error',
        error: 'Missing required fields: url and html are required.',
      })
      return
    }

    const html = await processImagesAndReplaceHtml(body.html, body.images, body.url, body.isWechat)

    const itemId = await importFromHtml(
      html,
      body.url,
      body.folderId,
      body.tags
    )

    sendJson(res, 200, {
      status: 'ok',
      data: { itemId, title: body.title },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[HttpServer] Error saving page:', errorMessage)
    sendJson(res, 500, {
      status: 'error',
      error: errorMessage,
    })
  }
}

async function handleGetFolders(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const tree = await folderRepo.getTree();
    sendJson(res, 200, {
      status: 'ok',
      data: tree,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[HttpServer] Error getting folders:', errorMessage);
    sendJson(res, 500, {
      status: 'error',
      error: errorMessage,
    });
  }
}

async function handleGetTags(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const tags = await tagRepo.findAll();
    sendJson(res, 200, {
      status: 'ok',
      data: tags,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[HttpServer] Error getting tags:', errorMessage);
    sendJson(res, 500, {
      status: 'error',
      error: errorMessage,
    });
  }
}

async function handleArchivePage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const body = (await parseBody(req)) as { url: string; folderId?: number; tags?: string[] }
    if (!body.url || !/^https?:\/\//i.test(body.url)) {
      sendJson(res, 400, { status: 'error', error: 'Missing or invalid url' })
      return
    }

    const result = await archiveFullPage(body.url)
    const itemId = await itemRepo.create({
      title: result.title || body.url,
      content: result.textContent.slice(0, 50000),
      contentHtml: result.html,
      contentType: 'article',
      sourceUrl: body.url,
      sourceType: 'web',
      sourceName: result.title,
      folderId: body.folderId ?? null,
      metadata: { archive: 'full' },
    })

    sendJson(res, 200, { status: 'ok', data: { itemId, title: result.title } })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[HttpServer] Error archiving page:', errorMessage)
    sendJson(res, 500, { status: 'error', error: errorMessage })
  }
}

function handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
  sendJson(res, 200, {
    status: 'ok',
    data: { status: 'ok', timestamp: new Date().toISOString() },
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // Set CORS headers on all responses
  setCorsHeaders(res)

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${DEFAULT_PORT}`)
  const pathname = parsedUrl.pathname

  try {
    if (pathname === '/api/save' && req.method === 'POST') {
      await handleSavePage(req, res)
    } else if (pathname === '/api/archive' && req.method === 'POST') {
      await handleArchivePage(req, res)
    } else if (pathname === '/api/folders' && req.method === 'GET') {
      await handleGetFolders(req, res)
    } else if (pathname === '/api/tags' && req.method === 'GET') {
      await handleGetTags(req, res)
    } else if (pathname === '/api/health' && req.method === 'GET') {
      handleHealth(req, res)
    } else {
      sendJson(res, 404, {
        status: 'error',
        error: `Not found: ${req.method} ${pathname}`,
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[HttpServer] Unhandled error:', errorMessage)
    sendJson(res, 500, {
      status: 'error',
      error: 'Internal server error',
    })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the local HTTP server for browser extension communication.
 * Provides a REST API as a backup communication channel when
 * Native Messaging is not available.
 *
 * Routes:
 *   POST /api/save    - Save page content
 *   GET  /api/folders - Get folder tree
 *   GET  /api/tags    - Get all tags
 *   GET  /api/health  - Health check
 *
 * @param port - Port number (default: 17321)
 * @returns The HTTP server instance
 */
export function startHttpServer(port: number = DEFAULT_PORT): http.Server {
  const server = http.createServer(handleRequest)

  server.on('error', (err: Error) => {
    console.error(`[HttpServer] Server error on port ${port}:`, err.message)
  })

  server.listen(port, () => {
    console.log(`[HttpServer] Server listening on http://localhost:${port}`)
  })

  return server
}

/**
 * Gracefully stop the HTTP server.
 * Closes all active connections and stops accepting new ones.
 *
 * @param server - The HTTP server instance to stop
 */
export function stopHttpServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      console.log('[HttpServer] Server stopped.')
      resolve()
    })

    // Force close after 5 seconds if connections are still open
    setTimeout(() => {
      server.closeAllConnections?.()
      resolve()
    }, 5000)
  })
}
