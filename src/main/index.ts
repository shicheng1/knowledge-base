/**
 * 知识库应用 - 主进程入口
 *
 * 负责:
 * - 创建主窗口
 * - 初始化数据库连接
 * - 注册 IPC 处理器
 * - 处理命令行参数（右键菜单集成、原生消息通信）
 */

import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc/index';
import { createPool, closePool, initDatabase } from './database/connection';
import { runMigrations } from './database/migrations';
import { itemRepo } from './database/repositories/item.repo';
import type { CreateItemDTO, ContentType } from './database/types';
import { getConfig, getStorageRootPath } from './utils/config';
import { logger } from './utils/logger';
import { extractFromHtml } from './services/content-extractor';
import { startNativeMessagingHost as startNativeMsgHost } from './services/native-messaging';
import { startHttpServer } from './integrations/http-server';
import { registerShortcut, unregisterShortcut } from './shortcut-manager';

// ---------------------------------------------------------------------------
// 单实例锁 + 命令行参数预处理
// 必须在 app.whenReady() 之前完成
// ---------------------------------------------------------------------------

// 解析命令行参数
function parseCommandLineArgs(argv: string[]): {
  saveFilePath: string | null;
  nativeMessagingHost: boolean;
} {
  const args = argv.slice(1);
  let saveFilePath: string | null = null;
  let nativeMessagingHost = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--save-file' && i + 1 < args.length) {
      saveFilePath = args[i + 1];
      i++;
    } else if (args[i] === '--native-messaging-host') {
      nativeMessagingHost = true;
    }
  }

  return { saveFilePath, nativeMessagingHost };
}

// 请求单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 第二个实例：将参数转发给第一个实例后退出
  const { saveFilePath } = parseCommandLineArgs(process.argv);
  // app.quit() 会在 app.whenReady() 后生效，这里直接退出进程
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 全局变量
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// 原生消息通信
// ---------------------------------------------------------------------------

function startNativeMessagingHost(): void {
  logger.info('启动原生消息通信主机模式');
  startNativeMsgHost();
}

// ---------------------------------------------------------------------------
// 右键菜单文件保存
// ---------------------------------------------------------------------------

/**
 * 处理右键菜单"保存到知识库"功能
 * 直接在主进程中将文件信息保存到数据库
 */
async function handleSaveFile(filePath: string): Promise<void> {
  logger.info('处理保存文件请求:', filePath);

  // 文件类型分类
  const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.csv', '.json', '.xml',
  ]);
  const CODE_EXTENSIONS = new Set([
    '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs',
    '.sh', '.bat', '.ps1', '.sql', '.yaml', '.yml', '.toml',
    '.css', '.scss', '.less',
  ]);
  const HTML_EXTENSIONS = new Set(['.html', '.htm']);
  const BINARY_DOCUMENT_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  ]);
  const IMAGE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
  ]);

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      logger.warn('路径不是文件:', filePath);
      return;
    }

    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();

    // 判断文件类型分类
    const isText = TEXT_EXTENSIONS.has(ext);
    const isCode = CODE_EXTENSIONS.has(ext);
    const isHtml = HTML_EXTENSIONS.has(ext);
    const isBinaryDoc = BINARY_DOCUMENT_EXTENSIONS.has(ext);
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isTextLike = isText || isCode || isHtml;

    // contentType 映射
    let contentType: ContentType = 'other';
    if (isText) {
      contentType = 'note';
    } else if (isHtml) {
      contentType = 'article';
    } else if (isCode) {
      contentType = 'code';
    } else if (isImage) {
      contentType = 'image';
    } else if (isBinaryDoc) {
      contentType = 'file';
    } else {
      contentType = 'file';
    }

    // 文本类文件：读取内容，不复制文件
    // 二进制文件：复制到存储目录
    let storedRelativePath: string | null = null;
    if (!isTextLike) {
      const storageRoot = getStorageRootPath();
      if (storageRoot) {
        try {
          await fs.mkdir(storageRoot, { recursive: true });
          let targetPath = path.join(storageRoot, fileName);
          try {
            await fs.access(targetPath);
            const baseName = path.basename(fileName, ext);
            const timestamp = Date.now();
            targetPath = path.join(storageRoot, `${baseName}_${timestamp}${ext}`);
          } catch {
            // 文件不存在，可以直接使用 targetPath
          }
          await fs.copyFile(filePath, targetPath);
          storedRelativePath = targetPath;
          logger.info('文件已复制到存储目录:', targetPath);
        } catch (err) {
          logger.warn('复制文件到存储目录失败，使用原始路径:', err);
          storedRelativePath = filePath;
        }
      } else {
        storedRelativePath = filePath;
      }
    }

    // 读取文件内容
    let content: string | null = null;
    let contentHtml: string | null = null;
    let summary: string | null = null;
    let title = fileName;
    const metadata: Record<string, unknown> = {};

    if (isHtml) {
      // HTML 文件：使用 extractFromHtml 提取结构化内容
      try {
        const rawContent = await readFileWithEncoding(filePath);
        const extracted = await extractFromHtml(rawContent, `file://${filePath}`);
        title = extracted.title || fileName;
        content = extracted.content;
        contentHtml = extracted.contentHtml;
        summary = extracted.summary;
        metadata.author = extracted.author;
        metadata.siteName = extracted.siteName;
        metadata.publishDate = extracted.publishDate;
        metadata.topImage = extracted.topImage;
      } catch (err) {
        logger.warn('HTML 文件提取失败，尝试直接读取:', err);
        try {
          content = await readFileWithEncoding(filePath);
        } catch (readErr) {
          logger.warn('读取文件内容失败:', readErr);
        }
      }
    } else if (isText || isCode) {
      // 文本/代码文件：读取内容，带编码处理
      try {
        content = await readFileWithEncoding(filePath);
        title = fileName.replace(/\.[^.]+$/, '');
        summary = content.trim().slice(0, 200).replace(/\s+/g, ' ') +
          (content.length > 200 ? '...' : '');
        if (isCode) {
          contentHtml = `<pre><code>${escapeHtml(content)}</code></pre>`;
        } else {
          contentHtml = `<pre>${escapeHtml(content)}</pre>`;
        }
      } catch (err) {
        logger.warn('读取文件内容失败:', err);
      }
    }

    const itemId = await itemRepo.create({
      title: title,
      content: content,
      contentHtml: contentHtml,
      summary: summary,
      contentType: contentType,
      sourceType: 'file',
      sourceName: 'Windows 资源管理器',
      filePath: storedRelativePath,
      fileSize: stat.size,
      mimeType: getMimeType(ext),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    logger.info(`文件已保存到知识库，ID: ${itemId}, 文件名: ${fileName}`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('item-created', { id: itemId, title: title });
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (error) {
    logger.error('保存文件到知识库失败:', error);
  }
}

/**
 * 读取文件内容，先尝试 UTF-8，如果检测到乱码则用 Latin1 作为 fallback
 */
async function readFileWithEncoding(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // 简单的乱码检测：如果包含大量替换字符，可能是编码问题
    const replacementCharCount = (content.match(/\uFFFD/g) || []).length;
    if (replacementCharCount > content.length * 0.05) {
      logger.info('检测到可能的编码问题，尝试 Latin1 编码读取');
      return await fs.readFile(filePath, 'latin1');
    }
    return content;
  } catch (err) {
    logger.warn('UTF-8 读取失败，尝试 Latin1:', err);
    return await fs.readFile(filePath, 'latin1');
  }
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 根据扩展名获取 MIME 类型
 */
function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java-source',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++src',
    '.h': 'text/x-chdr',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.sh': 'text/x-shellscript',
    '.bat': 'text/x-bat',
    '.ps1': 'text/x-powershell',
    '.sql': 'text/x-sql',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.toml': 'text/x-toml',
    '.css': 'text/css',
    '.scss': 'text/x-scss',
    '.less': 'text/x-less',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.html': 'text/html',
    '.htm': 'text/html',
  };
  return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// second-instance 事件处理
// ---------------------------------------------------------------------------

app.on('second-instance', (_event, commandLine) => {
  logger.info('检测到第二个实例启动，命令行参数:', commandLine);

  const { saveFilePath } = parseCommandLineArgs(commandLine);

  if (saveFilePath) {
    handleSaveFile(saveFilePath);
  } else {
    // 没有 --save-file 参数，只是聚焦窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  }
});

// ---------------------------------------------------------------------------
// 应用初始化
// ---------------------------------------------------------------------------

async function initializeApp(): Promise<void> {
  const { saveFilePath, nativeMessagingHost } = parseCommandLineArgs(process.argv);

  // 如果是原生消息通信模式
  if (nativeMessagingHost) {
    startNativeMessagingHost();
    return;
  }

  // 获取数据库配置
  const config = getConfig();
  const dbConfig = config.dbConfig;

  try {
    logger.info('正在初始化数据库连接...');
    await initDatabase(dbConfig);
    logger.info('数据库初始化成功');

    createPool(dbConfig);
    logger.info('连接池创建成功');

    await runMigrations();
    logger.info('数据库迁移完成');
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    logger.warn('将在无数据库连接状态下启动应用');
  }

  // 注册所有 IPC 处理器
  registerIpcHandlers();
  logger.info('IPC 处理器注册完成');

  // 启动 HTTP 服务器（供 Chrome 插件通信）
  startHttpServer();
  logger.info('HTTP 服务器已启动 (端口 17321)');

  // 注册全局快捷键
  registerShortcut();
  logger.info('全局快捷键已注册 (Alt+Shift+K)');

  // 创建主窗口
  mainWindow = createMainWindow();

  // 如果有保存文件参数，在窗口准备好后处理
  if (saveFilePath) {
    mainWindow.webContents.on('did-finish-load', () => {
      handleSaveFile(saveFilePath);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// 应用生命周期事件
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  protocol.handle('local-image', (request) => {
    let filePath = decodeURIComponent(request.url.replace('local-image://', ''))
    if (filePath.startsWith('/') && filePath.length > 2 && filePath.charAt(2) === ':') {
      filePath = filePath.substring(1)
    }
    try {
      const data = fsSync.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
      }
      const mimeType = mimeMap[ext] || 'image/png'
      return new Response(data, {
        headers: { 'content-type': mimeType },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  const webviewSession = session.fromPartition('persist:webview')
  webviewSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: false })
  })
  webviewSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true)
  })

  initializeApp().catch((error) => {
    logger.error('应用初始化失败:', error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
});

app.on('before-quit', async () => {
  unregisterShortcut();
  try {
    await closePool();
    logger.info('数据库连接池已关闭');
  } catch (error) {
    logger.error('关闭数据库连接池失败:', error);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});
