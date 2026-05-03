/**
 * API 封装层
 *
 * 对 window.api 的所有方法进行封装，提供类型安全的调用接口。
 * 各 View / Store 应优先使用此模块而非直接调用 window.api。
 */

/* ================================================================== */
/*  条目 (Item)                                                        */
/* ================================================================== */

export const itemApi = {
  /** 根据 ID 获取条目详情 */
  getById: (id: number) => window.api.item.getById(id),

  /** 获取条目列表，支持分页和筛选 */
  getList: (options?: {
    page?: number;
    page_size?: number;
    content_type?: string;
    folder_id?: number;
    is_favorite?: boolean;
    tag_id?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => window.api.item.getList(options),

  /** 创建新条目 */
  create: (data: {
    title: string;
    content?: string;
    summary?: string;
    content_type?: string;
    source_url?: string;
    folder_id?: number | null;
  }) => window.api.item.create(data),

  /** 更新条目 */
  update: (id: number, data: {
    title?: string;
    content?: string;
    summary?: string;
    content_type?: string;
    source_url?: string;
    folder_id?: number | null;
  }) => window.api.item.update(id, data),

  /** 删除条目 */
  delete: (id: number) => window.api.item.delete(id),

  /** 恢复已删除条目 */
  restore: (id: number) => window.api.item.restore(id),

  /** 永久删除条目 */
  permanentDelete: (id: number) => window.api.item.permanentDelete(id),

  /** 获取回收站列表 */
  getTrashList: (options?: { page?: number; pageSize?: number }) =>
    window.api.item.getTrashList(options),

  /** 清空回收站 */
  emptyTrash: () => window.api.item.emptyTrash(),

  /** 导出为 Markdown */
  exportMarkdown: (id: number) => window.api.item.exportMarkdown(id),

  /** 导出为 JSON */
  exportJSON: (id: number) => window.api.item.exportJSON(id),

  /** 批量导出为 ZIP */
  batchExport: (ids: number[]) => window.api.item.batchExport(ids),

  /** 搜索条目 */
  search: (keyword: string, options?: {
    content_type?: string;
    tag_id?: number;
    page?: number;
    page_size?: number;
  }) => window.api.item.search(keyword, options),

  /** 搜索建议 */
  searchSuggestions: (keyword: string) => window.api.item.searchSuggestions(keyword),

  /** 切换收藏状态 */
  toggleFavorite: (id: number) => window.api.item.toggleFavorite(id),

  /** 获取统计数据 */
  getStats: () => window.api.item.getStats(),

  /** 获取反向链接 */
  getBacklinks: (id: number) => window.api.item.getBacklinks(id),

  /** 获取出链 */
  getOutlinks: (id: number) => window.api.item.getOutlinks(id),

  /** 获取修订历史 */
  getRevisions: (id: number) => window.api.item.getRevisions(id),

  /** 恢复到指定修订版本 */
  restoreRevision: (revisionId: number) => window.api.item.restoreRevision(revisionId),

  /** 获取仪表盘统计 */
  getDashboardStats: () => window.api.item.getDashboardStats(),

  /** 获取模板列表 */
  getTemplates: () => window.api.item.getTemplates(),
};

/* ================================================================== */
/*  文件夹 (Folder)                                                    */
/* ================================================================== */

export const folderApi = {
  /** 获取文件夹树 */
  getTree: () => window.api.folder.getTree(),

  /** 根据 ID 获取文件夹详情 */
  getById: (id: number) => window.api.folder.getById(id),

  /** 创建文件夹 */
  create: (data: {
    name: string;
    parent_id?: number | null;
  }) => window.api.folder.create(data),

  /** 更新文件夹 */
  update: (id: number, data: {
    name?: string;
    parent_id?: number | null;
  }) => window.api.folder.update(id, data),

  /** 删除文件夹 */
  delete: (id: number) => window.api.folder.delete(id),

  /** 移动文件夹到新的父级 */
  move: (id: number, newParentId: number | null) =>
    window.api.folder.move(id, newParentId),
};

/* ================================================================== */
/*  标签 (Tag)                                                         */
/* ================================================================== */

export const tagApi = {
  /** 获取所有标签 */
  getAll: () => window.api.tag.getAll(),

  /** 创建标签 */
  create: (name: string, color?: string) => window.api.tag.create(name, color),

  /** 更新标签 */
  update: (id: number, data: {
    name?: string;
    color?: string;
  }) => window.api.tag.update(id, data),

  /** 删除标签 */
  delete: (id: number) => window.api.tag.delete(id),

  /** 获取条目的标签 */
  getByItem: (itemId: number) => window.api.tag.getByItem(itemId),

  /** 设置条目的标签 */
  setForItem: (itemId: number, tagIds: number[]) =>
    window.api.tag.setForItem(itemId, tagIds),
};

/* ================================================================== */
/*  设置 (Settings)                                                    */
/* ================================================================== */

export const settingsApi = {
  /** 获取单个设置项 */
  get: (key: string) => window.api.settings.get(key),

  /** 设置单个配置项 */
  set: (key: string, value: any) => window.api.settings.set(key, value),

  /** 获取所有设置 */
  getAll: () => window.api.settings.getAll(),

  /** 测试数据库连接 */
  testConnection: (config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) => window.api.settings.testConnection(config),

  /** 初始化数据库 */
  initDatabase: (config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) => window.api.settings.initDatabase(config),
};

/* ================================================================== */
/*  文件 (File)                                                        */
/* ================================================================== */

export const fileApi = {
  /** 选择目录 */
  selectDirectory: () => window.api.file.selectDirectory(),

  /** 导入文件 */
  importFile: (path: string, folderId?: number) =>
    window.api.file.importFile(path, folderId),

  /** 打开文件 */
  openFile: (path: string) => window.api.file.openFile(path),

  /** 读取文件为 Buffer */
  readFileAsBuffer: (filePath: string) => window.api.file.readFileAsBuffer(filePath),

  /** 创建空白 Word 文件 */
  createEmptyDocx: (fileName?: string) => window.api.file.createEmptyDocx(fileName),

  /** 创建空白 Excel 文件 */
  createEmptyXlsx: (fileName?: string) => window.api.file.createEmptyXlsx(fileName),

  /** 创建空白 Markdown 文件 */
  createEmptyMd: (fileName?: string) => window.api.file.createEmptyMd(fileName),

  /** 读取 Excel 数据 */
  readExcelData: (filePath: string) => window.api.file.readExcelData(filePath),

  /** 写入文件内容 */
  writeFileContent: (filePath: string, content: string) => window.api.file.writeFileContent(filePath, content),

  importByDrag: (filePaths: string[], folderId?: number | null) =>
    window.api.fileImport.importByDrag(filePaths, folderId),
};

export const integration = {
  isNativeMessagingRegistered: () => window.api.integration.isNativeMessagingRegistered(),
  registerNativeMessaging: (extensionId: string) => window.api.integration.registerNativeMessaging(extensionId),
  unregisterNativeMessaging: () => window.api.integration.unregisterNativeMessaging(),
  isContextMenuRegistered: () => window.api.integration.isContextMenuRegistered(),
  registerContextMenu: () => window.api.integration.registerContextMenu(),
  unregisterContextMenu: () => window.api.integration.unregisterContextMenu(),
};

export const feedApi = {
  getSources: () => window.api.feed.getSources(),
  addSource: (data: { name: string; url: string; type: string; description?: string; iconUrl?: string; siteUrl?: string; category?: string; enabled?: boolean; fetchIntervalMinutes?: number }) => window.api.feed.addSource(data),
  updateSource: (id: number, data: { name?: string; url?: string; description?: string; iconUrl?: string; siteUrl?: string; category?: string; enabled?: boolean; fetchIntervalMinutes?: number }) => window.api.feed.updateSource(id, data),
  deleteSource: (id: number) => window.api.feed.deleteSource(id),
  batchDeleteSources: (ids: number[]) => window.api.feed.batchDeleteSources(ids),
  toggleSource: (id: number) => window.api.feed.toggleSource(id),
  getItems: (options?: { page?: number; pageSize?: number; sourceId?: number; sourceType?: string; keyword?: string; importedOnly?: boolean; unimportedOnly?: boolean }) => window.api.feed.getItems(options),
  importItem: (feedItemId: number, folderId?: number) => window.api.feed.importItem(feedItemId, folderId),
  batchImport: (feedItemIds: number[], folderId?: number) => window.api.feed.batchImport(feedItemIds, folderId),
  refreshAll: () => window.api.feed.refreshAll(),
  refreshSource: (sourceId: number) => window.api.feed.refreshSource(sourceId),
  syncGitHubTrending: () => window.api.feed.syncGitHubTrending(),
  translateItem: (feedItemId: number) => window.api.feed.translateItem(feedItemId),
  getPresetSources: () => window.api.feed.getPresetSources(),
  importOpml: (content: string) => window.api.feed.importOpml(content),
};

/* ================================================================== */
/*  事件 (Events)                                                      */
/* ================================================================== */

export const events = {
  /** 监听主进程事件 */
  on: (channel: string, callback: (...args: any[]) => void) =>
    window.api.on(channel, callback),

  /** 取消监听主进程事件 */
  off: (channel: string, callback: (...args: any[]) => void) =>
    window.api.off(channel, callback),
};
