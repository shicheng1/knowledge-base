import { ipcMain, app } from 'electron';
import {
  registerShellMenu,
  unregisterShellMenu,
  isShellMenuRegistered,
} from '../integrations/shell-extension';
import type { IpcResult } from '../database/types';

/**
 * Register IPC handlers for Windows shell integration (right-click context menu).
 */
export function registerShellHandlers(): void {
  /**
   * Register Windows Explorer right-click context menu.
   */
  ipcMain.handle(
    'shell:registerMenu',
    async (): Promise<IpcResult<void>> => {
      try {
        const appPath = app.getPath('exe');
        await registerShellMenu(appPath);
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Unregister Windows Explorer right-click context menu.
   */
  ipcMain.handle(
    'shell:unregisterMenu',
    async (): Promise<IpcResult<void>> => {
      try {
        await unregisterShellMenu();
        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Check whether the shell context menu is registered.
   */
  ipcMain.handle(
    'shell:isRegistered',
    async (): Promise<IpcResult<boolean>> => {
      try {
        const registered = await isShellMenuRegistered();
        return { success: true, data: registered };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : String(error),
        };
      }
    }
  );
}
