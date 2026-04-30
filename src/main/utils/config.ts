/**
 * 应用配置管理
 *
 * 使用 electron-store v8 持久化存储应用配置
 */

import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

/** 数据库配置接口 */
export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** 应用配置接口 */
export interface AppConfig {
  dbConfig: DbConfig;
  storageRootPath: string;
  theme: 'light' | 'dark' | 'system';
  ocrEnabled: boolean;
}

/** electron-store 实例 */
let store: Store<AppConfig> | null = null;

/**
 * 初始化 Store 实例
 */
function getStore(): Store<AppConfig> {
  if (!store) {
    store = new Store<AppConfig>({
      name: 'config',
      defaults: {
        dbConfig: {
          host: 'localhost',
          port: 3306,
          user: 'root',
          password: 'root',
          database: 'knowledge_base',
        },
        storageRootPath: '',
        theme: 'system',
        ocrEnabled: false,
      },
    });

    logger.info('配置存储已初始化');
  }

  return store;
}

/**
 * 获取完整的应用配置
 * @returns 应用配置对象
 */
export function getConfig(): AppConfig {
  const s = getStore();
  return {
    dbConfig: s.get('dbConfig') as DbConfig,
    storageRootPath: s.get('storageRootPath') as string,
    theme: s.get('theme') as AppConfig['theme'],
    ocrEnabled: s.get('ocrEnabled') as boolean,
  };
}

/**
 * 设置应用配置
 * @param config - 要更新的配置（部分更新）
 */
export function setConfig(config: Partial<AppConfig>): void {
  const s = getStore();

  if (config.dbConfig !== undefined) {
    s.set('dbConfig', config.dbConfig);
  }
  if (config.storageRootPath !== undefined) {
    s.set('storageRootPath', config.storageRootPath);
  }
  if (config.theme !== undefined) {
    s.set('theme', config.theme);
  }

  logger.info('应用配置已更新');
}

/**
 * 获取数据库配置
 * @returns 数据库连接配置
 */
export function getDbConfig(): DbConfig {
  const s = getStore();
  return s.get('dbConfig') as DbConfig;
}

/**
 * 设置数据库配置
 * @param config - 数据库连接配置
 */
export function setDbConfig(config: DbConfig): void {
  const s = getStore();
  s.set('dbConfig', config);
  logger.info('数据库配置已更新');
}

/**
 * 获取存储根路径
 * 优先级：
 * 1. 已配置的 storageRootPath
 * 2. D:\KnowledgeBase（如果 D 盘存在）
 * 3. 用户文档目录下的 KnowledgeBase
 * 4. 用户数据目录下的 storage（最终回退）
 * @returns 存储根路径
 */
export function getStorageRootPath(): string {
  const s = getStore();
  let storagePath = s.get('storageRootPath') as string;

  if (!storagePath) {
    // 尝试使用非 C 盘路径
    const dDrive = 'D:\\KnowledgeBase';
    try {
      fs.accessSync('D:\\');
      storagePath = dDrive;
    } catch {
      // D 盘不存在，使用文档目录
      storagePath = path.join(app.getPath('documents'), 'KnowledgeBase');
    }

    s.set('storageRootPath', storagePath);
    logger.info(`默认存储路径已设置: ${storagePath}`);
  }

  return storagePath;
}

/**
 * 设置存储根路径
 * @param p - 存储根路径
 */
export function setStorageRootPath(p: string): void {
  const s = getStore();
  s.set('storageRootPath', p);
  logger.info(`存储路径已更新: ${p}`);
}

/**
 * 获取当前主题设置
 * @returns 主题设置
 */
export function getTheme(): 'light' | 'dark' | 'system' {
  const s = getStore();
  return s.get('theme') as AppConfig['theme'];
}

/**
 * 设置主题
 * @param theme - 主题设置
 */
export function setTheme(theme: 'light' | 'dark' | 'system'): void {
  const s = getStore();
  s.set('theme', theme);
  logger.info(`主题已更新: ${theme}`);
}

/**
 * 获取 OCR 是否启用
 */
export function getOcrEnabled(): boolean {
  const s = getStore();
  return s.get('ocrEnabled') as boolean;
}

/**
 * 设置 OCR 是否启用
 */
export function setOcrEnabled(enabled: boolean): void {
  const s = getStore();
  s.set('ocrEnabled', enabled);
  logger.info(`OCR 已${enabled ? '启用' : '禁用'}`);
}

/**
 * 重置所有配置为默认值
 */
export function resetConfig(): void {
  const s = getStore();
  s.clear();
  logger.info('所有配置已重置为默认值');
}
