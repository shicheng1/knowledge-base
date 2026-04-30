import { ipcMain } from 'electron';
import type { IpcResult } from '../database/types';
import { importObsidianVault } from '../services/obsidian-importer';
import { importBookmarks } from '../services/bookmark-importer';

export function registerImportHandlers(): void {
  ipcMain.handle('import:obsidianVault', async (_event, dirPath: string, parentFolderId?: number | null): Promise<IpcResult<{ total: number; imported: number; errors: string[] }>> => {
    try {
      const result = await importObsidianVault(dirPath, parentFolderId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('import:bookmarks', async (_event, filePath: string, parentFolderId?: number | null): Promise<IpcResult<{ total: number; imported: number; errors: string[] }>> => {
    try {
      const result = await importBookmarks(filePath, parentFolderId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
