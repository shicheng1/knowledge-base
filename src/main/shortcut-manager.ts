import { globalShortcut } from 'electron';
import { toggleQuickCaptureWindow } from './window';
import { logger } from './utils/logger';

const DEFAULT_ACCELERATOR = 'Alt+Shift+K';

let currentAccelerator: string | null = null;

/**
 * Register the global shortcut for quick capture.
 */
export function registerShortcut(accelerator?: string): void {
  const accel = accelerator || DEFAULT_ACCELERATOR;

  if (currentAccelerator === accel && globalShortcut.isRegistered(accel)) {
    return; // Already registered
  }

  // Unregister old shortcut if any
  if (currentAccelerator) {
    try {
      globalShortcut.unregister(currentAccelerator);
    } catch {
      // Ignore unregistration errors
    }
  }

  const success = globalShortcut.register(accel, () => {
    logger.info('全局快捷键触发:', accel);
    toggleQuickCaptureWindow();
  });

  if (success) {
    currentAccelerator = accel;
    logger.info(`全局快捷键已注册: ${accel}`);
  } else {
    logger.warn(`全局快捷键注册失败: ${accel}`);
  }
}

/**
 * Unregister the global shortcut.
 */
export function unregisterShortcut(): void {
  if (currentAccelerator) {
    try {
      globalShortcut.unregister(currentAccelerator);
      logger.info('全局快捷键已注销');
    } catch (err) {
      logger.warn('注销全局快捷键失败:', err);
    }
    currentAccelerator = null;
  }
}

/**
 * Check if shortcut is currently registered.
 */
export function isShortcutRegistered(): boolean {
  return currentAccelerator !== null && globalShortcut.isRegistered(currentAccelerator);
}

/**
 * Get the current shortcut accelerator string.
 */
export function getCurrentAccelerator(): string | null {
  return currentAccelerator;
}
