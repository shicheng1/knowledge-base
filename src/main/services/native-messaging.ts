import process from 'process'
import { importFromHtml } from './import-service'
import { processImagesAndReplaceHtml } from './image-downloader'
import { folderRepo } from '../database/repositories/folder.repo'
import { tagRepo } from '../database/repositories/tag.repo'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NativeMessage {
  type: 'save-page' | 'ping' | 'get-folders' | 'get-tags'
  data?: {
    url: string
    title: string
    html: string
    selectedText?: string
    author?: string
    publishDate?: string
    isWechat?: boolean
    images?: Array<{ src: string; alt?: string; dataUrl?: string; variants?: string[] }>
    folderId?: number
    tags?: string[]
  }
}

interface NativeResponse {
  type: string
  success?: boolean
  data?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Protocol helpers
// ---------------------------------------------------------------------------

const HEADER_SIZE = 4

/**
 * Read a single native messaging message from stdin.
 * Protocol: 4-byte little-endian length prefix + JSON body.
 */
export function readMessage(stdin: NodeJS.ReadStream): Promise<NativeMessage> {
  return new Promise((resolve, reject) => {
    const headerBuffer = Buffer.alloc(HEADER_SIZE)

    const readHeader = () => {
      stdin.once('readable', () => {
        const chunk = stdin.read()
        if (!chunk || (chunk as Buffer).length < HEADER_SIZE) {
          // May need to accumulate bytes across multiple reads
          if (chunk) {
            (chunk as Buffer).copy(headerBuffer, 0, 0, Math.min((chunk as Buffer).length, HEADER_SIZE))
          }
          accumulateBytes(stdin, headerBuffer, HEADER_SIZE, resolve, reject)
          return
        }
        (chunk as Buffer).copy(headerBuffer, 0, 0, HEADER_SIZE)
        readBody(headerBuffer)
      })
    }

    // If stdin is already in flowing mode, we may have data available
    if ((stdin as any).readableLength >= HEADER_SIZE) {
      const chunk = stdin.read()
      if (chunk) (chunk as Buffer).copy(headerBuffer, 0, 0, HEADER_SIZE)
      readBody(headerBuffer)
    } else {
      readHeader()
    }
  })
}

/**
 * Accumulate bytes from a stream until we have enough.
 */
function accumulateBytes(
  stream: NodeJS.ReadStream,
  target: Buffer,
  needed: number,
  resolve: (msg: NativeMessage) => void,
  reject: (err: Error) => void
): void {
  let offset = 0

  const onData = (chunk: Buffer) => {
    const toCopy = Math.min(chunk.length, needed - offset)
    chunk.copy(target, offset, 0, toCopy)
    offset += toCopy

    if (offset >= needed) {
      stream.removeListener('data', onData)
      stream.removeListener('end', onEnd)
      stream.removeListener('error', onError)
      readBody(target)
    }
  }

  const onEnd = () => {
    stream.removeListener('data', onData)
    stream.removeListener('error', onError)
    reject(new Error('stdin closed before complete message was received'))
  }

  const onError = (err: Error) => {
    stream.removeListener('data', onData)
    stream.removeListener('end', onEnd)
    reject(new Error(`stdin error: ${err.message}`))
  }

  stream.on('data', onData)
  stream.once('end', onEnd)
  stream.once('error', onError)
}

/**
 * Parse the body after reading the 4-byte header.
 */
function readBody(headerBuffer: Buffer): void {
  // The resolve/reject are captured via closure in accumulateBytes or passed directly.
  // We use a different approach here - this function is called from within the promise
  // chain established by readMessage.
  // This is handled internally via the message loop in startNativeMessagingHost.
}

/**
 * Read a complete message from stdin (header + body).
 * Returns a parsed NativeMessage object.
 */
function readFullMessage(stdin: NodeJS.ReadStream): Promise<NativeMessage> {
  return new Promise((resolve, reject) => {
    let headerReceived = false
    let bodyLength = 0
    let bodyBuffer: Buffer | null = null
    let bodyOffset = 0

    const onData = (chunk: Buffer) => {
      if (!headerReceived) {
        // We need exactly 4 bytes for the header
        if (chunk.length >= HEADER_SIZE) {
          bodyLength = chunk.readUInt32LE(0)
          headerReceived = true

          const remaining = chunk.slice(HEADER_SIZE)
          if (remaining.length >= bodyLength) {
            const jsonStr = remaining.slice(0, bodyLength).toString('utf-8')
            cleanup()
            try {
              resolve(JSON.parse(jsonStr) as NativeMessage)
            } catch (err) {
              reject(new Error(`Invalid JSON in message: ${err}`))
            }
            return
          }

          bodyBuffer = Buffer.alloc(bodyLength)
          remaining.copy(bodyBuffer, 0)
          bodyOffset = remaining.length
        } else {
          // Accumulate header bytes
          if (!bodyBuffer) {
            bodyBuffer = Buffer.alloc(HEADER_SIZE)
          }
          chunk.copy(bodyBuffer, bodyOffset)
          bodyOffset += chunk.length

          if (bodyOffset >= HEADER_SIZE) {
            bodyLength = bodyBuffer.readUInt32LE(0)
            headerReceived = true
            bodyBuffer = Buffer.alloc(bodyLength)
            bodyOffset = 0
          }
        }
      } else {
        // Accumulate body bytes
        const toCopy = Math.min(chunk.length, bodyLength - bodyOffset)
        chunk.copy(bodyBuffer!, bodyOffset, 0, toCopy)
        bodyOffset += toCopy

        if (bodyOffset >= bodyLength) {
          const jsonStr = bodyBuffer!.toString('utf-8')
          cleanup()
          try {
            resolve(JSON.parse(jsonStr) as NativeMessage)
          } catch (err) {
            reject(new Error(`Invalid JSON in message: ${err}`))
          }
        }
      }
    }

    const onEnd = () => {
      cleanup()
      reject(new Error('stdin closed before complete message was received'))
    }

    const onError = (err: Error) => {
      cleanup()
      reject(new Error(`stdin error: ${err.message}`))
    }

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.removeListener('end', onEnd)
      stdin.removeListener('error', onError)
    }

    stdin.on('data', onData)
    stdin.once('end', onEnd)
    stdin.once('error', onError)
  })
}

/**
 * Send a native messaging response to stdout.
 * Protocol: 4-byte little-endian length prefix + JSON body.
 */
export function sendMessage(stdout: NodeJS.WriteStream, message: NativeResponse): void {
  const jsonStr = JSON.stringify(message)
  const bodyBuffer = Buffer.from(jsonStr, 'utf-8')
  const headerBuffer = Buffer.alloc(HEADER_SIZE)
  headerBuffer.writeUInt32LE(bodyBuffer.length, 0)

  stdout.write(headerBuffer)
  stdout.write(bodyBuffer)
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

async function handlePing(): Promise<NativeResponse> {
  return { type: 'pong', success: true }
}

async function handleSavePage(data: NativeMessage['data']): Promise<NativeResponse> {
  if (!data) {
    return { type: 'save-page-result', success: false, error: 'No data provided' }
  }

  try {
    let html = data.html
    let title = data.title

    if (data.isWechat) {
      title = data.title || '微信公众号文章'
    }

    html = await processImagesAndReplaceHtml(html, data.images, data.url, data.isWechat)

    const tagNames = data.tags && data.tags.length > 0 ? data.tags : undefined

    const itemId = await importFromHtml(
      html,
      data.url,
      data.folderId,
      tagNames,
    )

    return {
      type: 'save-page-result',
      success: true,
      data: { itemId, title },
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return { type: 'save-page-result', success: false, error: errorMessage }
  }
}

async function handleGetFolders(): Promise<NativeResponse> {
  try {
    const tree = await folderRepo.getTree()
    return {
      type: 'folders-result',
      success: true,
      data: tree,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return { type: 'folders-result', success: false, error: errorMessage }
  }
}

async function handleGetTags(): Promise<NativeResponse> {
  try {
    const tags = await tagRepo.findAll()
    return {
      type: 'tags-result',
      success: true,
      data: tags,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return { type: 'tags-result', success: false, error: errorMessage }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Start the Native Messaging Host.
 * Reads messages from stdin, dispatches to handlers, and writes responses to stdout.
 * Runs until stdin is closed or an unrecoverable error occurs.
 */
export function startNativeMessagingHost(): void {
  // Set stdin to raw/binary mode
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  console.error('[NativeMessaging] Host started, waiting for messages...')

  const messageLoop = async () => {
    while (true) {
      try {
        const message = await readFullMessage(process.stdin)
        console.error(`[NativeMessaging] Received message type: ${message.type}`)

        let response: NativeResponse

        switch (message.type) {
          case 'ping':
            response = await handlePing()
            break

          case 'save-page':
            response = await handleSavePage(message.data)
            break

          case 'get-folders':
            response = await handleGetFolders()
            break

          case 'get-tags':
            response = await handleGetTags()
            break

          default:
            response = {
              type: 'error',
              success: false,
              error: `Unknown message type: ${(message as any).type}`,
            }
        }

        sendMessage(process.stdout, response)
        console.error(`[NativeMessaging] Sent response type: ${response.type}`)
      } catch (err) {
        if (err instanceof Error && err.message.includes('stdin closed')) {
          console.error('[NativeMessaging] stdin closed, shutting down.')
          break
        }
        console.error('[NativeMessaging] Error processing message:', err)
        // Send error response if possible
        try {
          sendMessage(process.stdout, {
            type: 'error',
            success: false,
            error: err instanceof Error ? err.message : String(err),
          })
        } catch {
          // stdout may also be closed
        }
      }
    }
  }

  messageLoop().catch((err) => {
    console.error('[NativeMessaging] Fatal error:', err)
    process.exit(1)
  })
}
