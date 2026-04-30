import { contextBridge, ipcRenderer } from 'electron';

/** 允许渲染进程监听的主进程事件频道白名单 */
const ALLOWED_CHANNELS: string[] = [
  'item-created',
  'item-updated',
  'item-deleted',
  'folder-created',
  'folder-updated',
  'folder-deleted',
  'tag-created',
  'tag-updated',
  'tag-deleted',
  'settings-changed',
  'db-connection-status',
  'file-dropped',
  'quick-capture:focus',
];

/**
 * 解包 IPC 返回值
 * IPC handler 返回 { success: true, data } 或 { success: false, error }
 * 这里统一解包，让渲染进程直接拿到 data
 */
async function invoke(channel: string, ...args: any[]): Promise<any> {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'success' in result) {
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error || '操作失败');
  }
  // 兼容直接返回值的情况
  return result;
}

const api = {
  // ── 条目 API ──────────────────────────────────────────────
  item: {
    getById: (id: number) => invoke('item:getById', id),
    getList: (options?: any) => invoke('item:getList', options),
    create: (data: any) => invoke('item:create', data),
    update: (id: number, data: any) => invoke('item:update', id, data),
    delete: (id: number) => invoke('item:delete', id),
    restore: (id: number) => invoke('item:restore', id),
    permanentDelete: (id: number) => invoke('item:permanentDelete', id),
    getTrashList: (options?: { page?: number; pageSize?: number }) => invoke('item:getTrashList', options),
    emptyTrash: () => invoke('item:emptyTrash'),
    batchDelete: (ids: number[]) => invoke('item:batchDelete', ids),
    exportMarkdown: (id: number) => invoke('item:exportMarkdown', id),
    exportJSON: (id: number) => invoke('item:exportJSON', id),
    batchExport: (ids: number[]) => invoke('item:batchExport', ids),
    search: (keyword: string, options?: any) =>
      invoke('item:search', keyword, options),
    searchSuggestions: (keyword: string) =>
      invoke('item:searchSuggestions', keyword),
    toggleFavorite: (id: number) => invoke('item:toggleFavorite', id),
    togglePin: (id: number) => invoke('item:togglePin', id),
    getStats: () => invoke('item:getStats'),
    getBacklinks: (id: number) => invoke('item:getBacklinks', id),
    getOutlinks: (id: number) => invoke('item:getOutlinks', id),
    getRevisions: (id: number) => invoke('item:getRevisions', id),
    restoreRevision: (revisionId: number) => invoke('item:restoreRevision', revisionId),
    getDashboardStats: () => invoke('item:getDashboardStats'),
    getTemplates: () => invoke('item:getTemplates'),
  },

  // ── 文件夹 API ────────────────────────────────────────────
  folder: {
    getTree: () => invoke('folder:getTree'),
    getById: (id: number) => invoke('folder:getById', id),
    create: (data: any) => invoke('folder:create', data),
    update: (id: number, data: any) => invoke('folder:update', id, data),
    delete: (id: number) => invoke('folder:delete', id),
    move: (id: number, newParentId: number | null) =>
      invoke('folder:move', id, newParentId),
  },

  // ── 标签 API ──────────────────────────────────────────────
  tag: {
    getAll: () => invoke('tag:getAll'),
    create: (name: string, color?: string) =>
      invoke('tag:create', name, color),
    update: (id: number, data: any) => invoke('tag:update', id, data),
    delete: (id: number) => invoke('tag:delete', id),
    getByItem: (itemId: number) => invoke('tag:getByItem', itemId),
    setForItem: (itemId: number, tagIds: number[]) =>
      invoke('tag:setForItem', itemId, tagIds),
  },

  // ── 设置 API ──────────────────────────────────────────────
  settings: {
    get: (key: string) => invoke('settings:get', key),
    set: (key: string, value: any) => invoke('settings:set', key, value),
    getAll: () => invoke('settings:getAll'),
    testConnection: (config: any) => invoke('settings:testConnection', config),
    initDatabase: (config: any) => invoke('settings:initDatabase', config),
  },

  // ── 文件 API ──────────────────────────────────────────────
  file: {
    selectDirectory: () => invoke('file:selectDirectory'),
    importFile: (path: string, folderId?: number) =>
      invoke('file:importFile', path, folderId),
    openFile: (path: string) => invoke('file:openFile', path),
    readFileAsBuffer: (filePath: string) => invoke('file:readFileAsBuffer', filePath),
    createEmptyDocx: (fileName?: string) => invoke('file:createEmptyDocx', fileName),
    createEmptyXlsx: (fileName?: string) => invoke('file:createEmptyXlsx', fileName),
    createEmptyMd: (fileName?: string) => invoke('file:createEmptyMd', fileName),
    readExcelData: (filePath: string) => invoke('file:readExcelData', filePath),
    writeFileContent: (filePath: string, content: string) => invoke('file:writeFileContent', filePath, content),
  },

  integration: {
    isNativeMessagingRegistered: () => invoke('integration:isNativeMessagingRegistered'),
    registerNativeMessaging: (extensionId: string) => invoke('integration:registerNativeMessaging', extensionId),
    unregisterNativeMessaging: () => invoke('integration:unregisterNativeMessaging'),
    isContextMenuRegistered: () => invoke('integration:isContextMenuRegistered'),
    registerContextMenu: () => invoke('integration:registerContextMenu'),
    unregisterContextMenu: () => invoke('integration:unregisterContextMenu'),
  },

  editor: {
    selectImage: (itemId: number) => invoke('editor:selectImage', itemId),
    saveImageBuffer: (itemId: number, arrayBuffer: number[], mimeType: string) =>
      invoke('editor:saveImageBuffer', itemId, arrayBuffer, mimeType),
  },

  // ── 文件导入 API ─────────────────────────────────────────
  fileImport: {
    importByDrag: (files: Array<{ name: string; content?: string; arrayBuffer?: number[]; type: string; isBinary: boolean }>, folderId?: number | null) =>
      invoke('file:importByDrag', files, folderId),
    importFilesByContent: (files: Array<{ name: string; content: string; type: string; isBinary: boolean }>, folderId?: number | null) =>
      invoke('file:importFilesByContent', files, folderId),
  },

  // ── 系统集成 API ─────────────────────────────────────────
  shell: {
    registerMenu: () => invoke('shell:registerMenu'),
    unregisterMenu: () => invoke('shell:unregisterMenu'),
    isRegistered: () => invoke('shell:isRegistered'),
  },

  // ── 快捷键 API ───────────────────────────────────────────
  shortcut: {
    register: (accelerator: string) => invoke('shortcut:register', accelerator),
    unregister: () => invoke('shortcut:unregister'),
    isRegistered: () => invoke('shortcut:isRegistered'),
    getAccelerator: () => invoke('shortcut:getAccelerator'),
  },

  // ── 导入 API ─────────────────────────────────────────────
  import: {
    obsidianVault: (dirPath: string, parentFolderId?: number | null) =>
      invoke('import:obsidianVault', dirPath, parentFolderId),
    bookmarks: (filePath: string, parentFolderId?: number | null) =>
      invoke('import:bookmarks', filePath, parentFolderId),
  },

  // ── 事件监听（带频道白名单验证） ─────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) =>
        callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    console.warn(`[preload] 阻止了未授权的事件频道监听: ${channel}`);
    return () => {};
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
};

contextBridge.exposeInMainWorld('api', api);
