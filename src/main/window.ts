import { BrowserWindow, shell, app } from 'electron';
import { join } from 'path';
import { logger } from './utils/logger';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let quickCaptureWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    title: '知识库',
    icon: isDev
      ? join(__dirname, '../../resources/icon.png')
      : join(process.resourcesPath, 'resources/icon.png'),
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      experimentalFeatures: false,
      webSecurity: true,
      webviewTag: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  loadRenderer(mainWindow, '/');

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://') && !url.includes('renderer')) {
      event.preventDefault();
      logger.info('阻止了外部 file:// 导航:', url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('devtools-opened', () => {
    logger.info('开发者工具已打开');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('主窗口已关闭');
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

export function createQuickCaptureWindow(): BrowserWindow {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.show();
    quickCaptureWindow.focus();
    return quickCaptureWindow;
  }

  quickCaptureWindow = new BrowserWindow({
    title: '快速捕获',
    width: 520,
    height: 480,
    minWidth: 380,
    minHeight: 320,
    show: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  loadRenderer(quickCaptureWindow, '#/quick-capture');

  quickCaptureWindow.on('ready-to-show', () => {
    quickCaptureWindow?.show();
    quickCaptureWindow?.focus();
  });

  quickCaptureWindow.on('blur', () => {
    // Auto-hide when losing focus
    if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
      quickCaptureWindow.hide();
    }
  });

  quickCaptureWindow.on('closed', () => {
    quickCaptureWindow = null;
  });

  return quickCaptureWindow;
}

export function toggleQuickCaptureWindow(): void {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    if (quickCaptureWindow.isVisible()) {
      quickCaptureWindow.hide();
    } else {
      quickCaptureWindow.show();
      quickCaptureWindow.focus();
      quickCaptureWindow.webContents.send('quick-capture:focus');
    }
  } else {
    createQuickCaptureWindow();
  }
}

function loadRenderer(window: BrowserWindow, hash?: string): void {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    const url = hash ? `${process.env['ELECTRON_RENDERER_URL']}${hash}` : process.env['ELECTRON_RENDERER_URL'];
    window.loadURL(url).catch((error) => {
      logger.error('加载开发服务器失败:', error);
    });
    if (window === mainWindow) {
      setupHMR(window);
    }
  } else {
    const indexPath = join(__dirname, '../renderer/index.html');
    window.loadFile(indexPath, hash ? { hash: hash.replace('#', '') } : undefined).catch((error) => {
      logger.error('加载渲染页面失败:', error);
    });
  }
}

function setupHMR(window: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!rendererUrl) {
    return;
  }

  try {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');

    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name: string) => {
        logger.info(`已安装扩展: ${name}`);
      })
      .catch((err: Error) => {
        logger.warn('安装 React DevTools 扩展失败:', err.message);
      });
  } catch {
    logger.warn('electron-devtools-installer 未安装，跳过 DevTools 扩展安装');
  }

  window.webContents.on('render-process-gone', (event, details) => {
    logger.error('渲染进程崩溃:', details);
    if (details.reason === 'crashed') {
      logger.info('尝试重新加载渲染进程...');
      setTimeout(() => {
        if (!window.isDestroyed()) {
          loadRenderer(window, '/');
        }
      }, 2000);
    }
  });
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getQuickCaptureWindow(): BrowserWindow | null {
  return quickCaptureWindow;
}
