import { ipcMain } from 'electron';
import { getConfig, setConfig, getDbConfig, setDbConfig, getOcrEnabled, setOcrEnabled } from '../utils/config';
import { testConnection, initDatabase, createPool } from '../database/connection';
import { runMigrations } from '../database/migrations';
import type { IpcResult } from '../database/types';
import type { DatabaseConfig } from '../database/connection';

/**
 * Register IPC handlers for settings and database configuration operations.
 */
export function registerSettingsHandlers(): void {
  /**
   * Get a single configuration value by key.
   */
  ipcMain.handle('settings:get', async (_event, key: string): Promise<IpcResult<string | null>> => {
    try {
      const config = getConfig();
      const value = (config as unknown as Record<string, unknown>)[key];
      return { success: true, data: value !== undefined ? String(value) : null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Set a configuration value.
   * 支持两种模式：
   * 1. 扁平 key-value（db_host, db_port 等）→ 同步更新 dbConfig 对象
   * 2. 直接设置 dbConfig/storageRootPath/theme 对象
   */
  ipcMain.handle('settings:set', async (_event, key: string, value: string): Promise<IpcResult<void>> => {
    try {
      // 扁平 key → 更新对应的 dbConfig 字段
      const dbKeyMap: Record<string, keyof import('../utils/config').DbConfig> = {
        db_host: 'host',
        db_port: 'port',
        db_user: 'user',
        db_password: 'password',
        db_name: 'database',
      };

      if (dbKeyMap[key]) {
        const currentDbConfig = getDbConfig();
        const field = dbKeyMap[key];
        (currentDbConfig as any)[field] = field === 'port' ? Number(value) : value;
        setDbConfig(currentDbConfig);
      } else if (key === 'storage_root_path') {
        setConfig({ storageRootPath: value } as any);
      } else if (key === 'theme') {
        setConfig({ theme: value } as any);
      } else if (key === 'ocr_enabled') {
        setOcrEnabled(value === 'true' || value === '1');
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get all configuration values as a flat key-value object.
   */
  ipcMain.handle('settings:getAll', async (): Promise<IpcResult<Record<string, any>>> => {
    try {
      const config = getConfig();
      const dbConfig = config.dbConfig;
      // 返回扁平结构，方便设置页面使用
      const flat: Record<string, any> = {
        db_host: dbConfig.host,
        db_port: String(dbConfig.port),
        db_user: dbConfig.user,
        db_password: dbConfig.password,
        db_name: dbConfig.database,
        storage_root_path: config.storageRootPath,
        theme: config.theme,
        ocr_enabled: String(config.ocrEnabled),
      };
      return { success: true, data: flat };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Test the database connection.
   */
  ipcMain.handle('settings:testConnection', async (): Promise<IpcResult<boolean>> => {
    try {
      const dbConfig = getDbConfig();
      const result = await testConnection(dbConfig);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Initialize the database: create pool and run migrations.
   */
  ipcMain.handle('settings:initDatabase', async (): Promise<IpcResult<void>> => {
    try {
      const dbConfig = getDbConfig();
      await initDatabase(dbConfig);
      await createPool(dbConfig);
      await runMigrations();
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
