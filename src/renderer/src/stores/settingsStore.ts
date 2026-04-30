import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface SettingsState {
  dbConfig: DbConfig;
  storageRootPath: string;
  theme: 'light' | 'dark' | 'system';
  connected: boolean;
  loading: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  saveDbConfig: (config: DbConfig) => Promise<void>;
  testConnection: (config: DbConfig) => Promise<{ success: boolean; message: string }>;
  initDatabase: (config: DbConfig) => Promise<{ success: boolean; message: string }>;
  setStorageRootPath: (path: string) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  dbConfig: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'knowledge_base',
  },
  storageRootPath: '',
  theme: 'system',
  connected: false,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const all = await window.api.settings.getAll();
      if (all) {
        const dbConfig: DbConfig = {
          host: all.db_host ?? 'localhost',
          port: Number(all.db_port) || 3306,
          user: all.db_user ?? 'root',
          password: all.db_password ?? 'root',
          database: all.db_name ?? 'knowledge_base',
        };
        const storageRootPath = all.storage_root_path ?? '';
        const theme = (all.theme as 'light' | 'dark' | 'system') ?? 'system';
        set({ dbConfig, storageRootPath, theme });
      }
    } catch (err: any) {
      set({ error: err?.message ?? '加载设置失败' });
    } finally {
      set({ loading: false });
    }
  },

  saveDbConfig: async (config: DbConfig) => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        window.api.settings.set('db_host', config.host),
        window.api.settings.set('db_port', String(config.port)),
        window.api.settings.set('db_user', config.user),
        window.api.settings.set('db_password', config.password),
        window.api.settings.set('db_name', config.database),
      ]);
      set({ dbConfig: config, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '保存数据库配置失败', loading: false });
    }
  },

  testConnection: async (config: DbConfig) => {
    set({ loading: true, error: null });
    try {
      const result = await window.api.settings.testConnection(config);
      set({ connected: result?.success ?? false, loading: false });
      return {
        success: result?.success ?? false,
        message: result?.message ?? (result?.success ? '连接成功' : '连接失败'),
      };
    } catch (err: any) {
      const message = err?.message ?? '连接测试失败';
      set({ connected: false, error: message, loading: false });
      return { success: false, message };
    }
  },

  initDatabase: async (config: DbConfig) => {
    set({ loading: true, error: null });
    try {
      const result = await window.api.settings.initDatabase(config);
      set({ connected: result?.success ?? false, loading: false });
      return {
        success: result?.success ?? false,
        message: result?.message ?? (result?.success ? '初始化成功' : '初始化失败'),
      };
    } catch (err: any) {
      const message = err?.message ?? '数据库初始化失败';
      set({ connected: false, error: message, loading: false });
      return { success: false, message };
    }
  },

  setStorageRootPath: async (path: string) => {
    try {
      await window.api.settings.set('storage_root_path', path);
      set({ storageRootPath: path });
    } catch (err: any) {
      set({ error: err?.message ?? '设置存储目录失败' });
    }
  },

  setTheme: async (theme: 'light' | 'dark' | 'system') => {
    try {
      await window.api.settings.set('theme', theme);
      set({ theme });
    } catch (err: any) {
      set({ error: err?.message ?? '设置主题失败' });
    }
  },
}));
