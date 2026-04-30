import { ipcMain } from 'electron';
import {
  isNativeMessagingRegistered,
  registerNativeMessaging,
  unregisterNativeMessaging,
  isContextMenuRegistered,
  registerContextMenu,
  unregisterContextMenu,
} from '../services/integration';
import type { IpcResult } from '../database/types';

export function registerIntegrationHandlers(): void {
  ipcMain.handle(
    'integration:isNativeMessagingRegistered',
    async (): Promise<IpcResult<boolean>> => {
      try {
        const registered = isNativeMessagingRegistered();
        return { success: true, data: registered };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    'integration:registerNativeMessaging',
    async (_event, extensionId: string): Promise<IpcResult<void>> => {
      const result = registerNativeMessaging(extensionId);
      if (result.success) {
        return { success: true, data: undefined };
      }
      return { success: false, error: result.error };
    },
  );

  ipcMain.handle(
    'integration:unregisterNativeMessaging',
    async (): Promise<IpcResult<void>> => {
      const result = unregisterNativeMessaging();
      if (result.success) {
        return { success: true, data: undefined };
      }
      return { success: false, error: result.error };
    },
  );

  ipcMain.handle(
    'integration:isContextMenuRegistered',
    async (): Promise<IpcResult<boolean>> => {
      try {
        const registered = isContextMenuRegistered();
        return { success: true, data: registered };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    'integration:registerContextMenu',
    async (): Promise<IpcResult<void>> => {
      const result = registerContextMenu();
      if (result.success) {
        return { success: true, data: undefined };
      }
      return { success: false, error: result.error };
    },
  );

  ipcMain.handle(
    'integration:unregisterContextMenu',
    async (): Promise<IpcResult<void>> => {
      const result = unregisterContextMenu();
      if (result.success) {
        return { success: true, data: undefined };
      }
      return { success: false, error: result.error };
    },
  );
}
