/**
 * 简单日志工具
 *
 * 提供带时间戳和日志级别的日志输出功能
 */

/** 日志级别 */
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * 获取格式化的时间戳
 * @returns ISO 格式时间戳字符串
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 格式化日志消息
 * @param level - 日志级别
 * @param messages - 日志消息
 * @returns 格式化后的日志字符串
 */
function formatMessage(level: LogLevel, messages: unknown[]): string {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level}]`;

  const formattedMessages = messages.map((msg) => {
    if (msg instanceof Error) {
      return `${msg.message}\n${msg.stack || ''}`;
    }
    if (typeof msg === 'object' && msg !== null) {
      try {
        return JSON.stringify(msg, null, 2);
      } catch {
        return String(msg);
      }
    }
    return String(msg);
  });

  return `${prefix} ${formattedMessages.join(' ')}`;
}

/**
 * 输出 INFO 级别日志
 * @param messages - 日志消息（支持多个参数）
 */
export function info(...messages: unknown[]): void {
  console.log(formatMessage('INFO', messages));
}

/**
 * 输出 WARN 级别日志
 * @param messages - 日志消息（支持多个参数）
 */
export function warn(...messages: unknown[]): void {
  console.warn(formatMessage('WARN', messages));
}

/**
 * 输出 ERROR 级别日志
 * @param messages - 日志消息（支持多个参数）
 */
export function error(...messages: unknown[]): void {
  console.error(formatMessage('ERROR', messages));
}

/**
 * 输出 DEBUG 级别日志
 * 仅在开发模式下输出
 * @param messages - 日志消息（支持多个参数）
 */
export function debug(...messages: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(formatMessage('DEBUG', messages));
  }
}

/**
 * 聚合导出的 logger 对象
 * 支持两种使用方式：
 *   import { logger } from './logger'; logger.info('...')
 *   import { info } from './logger'; info('...')
 */
export const logger = {
  info,
  warn,
  error,
  debug,
} as const;
