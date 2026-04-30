/**
 * MySQL 数据库连接池管理
 *
 * 提供连接池的创建、查询执行、连接测试和资源清理功能
 */

import mysql, { Pool, PoolOptions, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { logger } from '../utils/logger';

/** 数据库连接配置 */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** 模块级连接池实例 */
let pool: Pool | null = null;

/**
 * 创建数据库连接池
 * @param config - 数据库连接配置
 * @returns 创建好的连接池
 * @throws 如果创建失败则抛出错误
 */
export async function createPool(config: DatabaseConfig): Promise<Pool> {
  // 如果已有连接池，先关闭
  if (pool) {
    await closePool();
  }

  const poolOptions: PoolOptions = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    // 连接池配置
    connectionLimit: 10,
    waitForConnections: true,
    idleTimeout: 60000, // 60秒空闲超时
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // 字符集配置
    charset: 'utf8mb4',
    // 时区设置
    timezone: '+00:00',
    // 支持多语句查询（迁移脚本需要）
    multipleStatements: true,
  };

  try {
    pool = mysql.createPool(poolOptions);

    // 验证连接池可用
    const connection = await pool.getConnection();
    logger.info(`数据库连接池已创建 [${config.host}:${config.port}/${config.database}]`);
    connection.release();

    return pool;
  } catch (error) {
    pool = null;
    logger.error('创建数据库连接池失败:', error);
    throw new Error(`无法连接到数据库 ${config.host}:${config.port}/${config.database}: ${(error as Error).message}`);
  }
}

/**
 * 获取当前连接池
 * @returns 当前连接池实例，如果未创建则返回 null
 */
export function getPool(): Pool | null {
  return pool;
}

/**
 * 执行参数化查询
 * @param sql - SQL 查询语句，使用 ? 作为参数占位符
 * @param params - 查询参数
 * @returns 查询结果行
 * @throws 如果连接池未初始化或查询失败
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  if (!pool) {
    throw new Error('数据库连接池未初始化，请先调用 createPool()');
  }

  try {
    const [results] = await pool.execute<T>(sql, params as any[]);
    return results;
  } catch (error) {
    logger.error(`查询执行失败 [SQL: ${sql}]:`, error);
    throw error;
  }
}

/**
 * 执行原始 SQL（支持多条语句，用于迁移等场景）
 * @param sql - SQL 语句
 * @returns 执行结果
 */
export async function executeRaw(sql: string): Promise<void> {
  if (!pool) {
    throw new Error('数据库连接池未初始化，请先调用 createPool()');
  }

  try {
    await pool.query(sql);
  } catch (error) {
    logger.error('原始 SQL 执行失败:', error);
    throw error;
  }
}

/**
 * 初始化数据库
 * 创建 knowledge_base 数据库（如果不存在）
 * @param config - 数据库连接配置（不包含数据库名）
 */
export async function initDatabase(config: DatabaseConfig): Promise<void> {
  // 先连接到 MySQL 服务器（不指定数据库），创建数据库
  const initPool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    // 不指定数据库，连接到 MySQL 服务器
    multipleStatements: true,
    connectionLimit: 1,
  });

  try {
    const dbName = config.database.replace(/`/g, '``'); // 防止 SQL 注入
    await initPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    logger.info(`数据库 "${config.database}" 已就绪`);
  } catch (error) {
    logger.error('创建数据库失败:', error);
    throw new Error(`创建数据库失败: ${(error as Error).message}`);
  } finally {
    await initPool.end();
  }
}

/**
 * 测试数据库连接
 * @param config - 数据库连接配置
 * @returns 连接是否成功
 */
export async function testConnection(config: DatabaseConfig): Promise<boolean> {
  let testPool: Pool | null = null;

  try {
    testPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: 1,
      connectTimeout: 10000, // 10秒连接超时
    });

    const connection = await testPool.getConnection();
    await connection.ping();
    connection.release();

    logger.info(`数据库连接测试成功 [${config.host}:${config.port}/${config.database}]`);
    return true;
  } catch (error) {
    logger.error(`数据库连接测试失败 [${config.host}:${config.port}/${config.database}]:`, error);
    return false;
  } finally {
    if (testPool) {
      try {
        await testPool.end();
      } catch {
        // 忽略关闭错误
      }
    }
  }
}

/**
 * 关闭连接池
 * 释放所有数据库连接
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      logger.info('数据库连接池已关闭');
    } catch (error) {
      logger.error('关闭数据库连接池时出错:', error);
    } finally {
      pool = null;
    }
  }
}
