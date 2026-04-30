export interface ItemApi {
  getById: (id: number) => Promise<any>;
  getList: (options?: any) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: number, data: any) => Promise<any>;
  delete: (id: number) => Promise<any>;
  search: (keyword: string, options?: any) => Promise<any>;
  toggleFavorite: (id: number) => Promise<any>;
  togglePin: (id: number) => Promise<any>;
  getStats: () => Promise<any>;
  getBacklinks: (id: number) => Promise<any>;
  getOutlinks: (id: number) => Promise<any>;
  getRevisions: (id: number) => Promise<any>;
  restoreRevision: (revisionId: number) => Promise<any>;
  getDashboardStats: () => Promise<any>;
}

export interface FolderApi {
  getTree: () => Promise<any>;
  getById: (id: number) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: number, data: any) => Promise<any>;
  delete: (id: number) => Promise<any>;
  move: (id: number, newParentId: number | null) => Promise<any>;
}

export interface TagApi {
  getAll: () => Promise<any>;
  create: (name: string, color?: string) => Promise<any>;
  update: (id: number, data: any) => Promise<any>;
  delete: (id: number) => Promise<any>;
  getByItem: (itemId: number) => Promise<any>;
  setForItem: (itemId: number, tagIds: number[]) => Promise<any>;
}

export interface SettingsApi {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<any>;
  getAll: () => Promise<any>;
  testConnection: (config: any) => Promise<any>;
  initDatabase: (config: any) => Promise<any>;
}

export interface FileApi {
  selectDirectory: () => Promise<any>;
  importFile: (path: string, folderId?: number) => Promise<any>;
  openFile: (path: string) => Promise<any>;
}

export interface ShellApi {
  registerMenu: () => Promise<any>;
  unregisterMenu: () => Promise<any>;
  isRegistered: () => Promise<any>;
}

export interface ElectronApi {
  item: ItemApi;
  folder: FolderApi;
  tag: TagApi;
  settings: SettingsApi;
  file: FileApi;
  shell: ShellApi;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}

export {};
