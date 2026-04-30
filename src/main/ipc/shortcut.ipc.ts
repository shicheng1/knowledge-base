import { ipcMain } from 'electron';
import { registerShortcut, unregisterShortcut, isShortcutRegistered, getCurrentAccelerator } from '../shortcut-manager';
import type { IpcResult } from '../database/types';

export function registerShortcutHandlers(): void {
  ipcMain.handle('shortcut:register', async (_event, accelerator: string): Promise<IpcResult<void>> => {
    try {
      registerShortcut(accelerator);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('shortcut:unregister', async (): Promise<IpcResult<void>> => {
    try {
      unregisterShortcut();
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('shortcut:isRegistered', async (): Promise<IpcResult<boolean>> => {
    try {
      return { success: true, data: isShortcutRegistered() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('shortcut:getAccelerator', async (): Promise<IpcResult<string | null>> => {
    try {
      return { success: true, data: getCurrentAccelerator() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
