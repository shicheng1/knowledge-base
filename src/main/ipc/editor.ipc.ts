import { ipcMain } from 'electron';
import { saveImageBuffer, selectImageFile } from '../services/editor-image.service';
import type { IpcResult } from '../database/types';

export function registerEditorHandlers(): void {
  ipcMain.handle(
    'editor:selectImage',
    async (_event, itemId: number): Promise<IpcResult<{ localSrc: string } | null>> => {
      try {
        const result = selectImageFile();
        if (!result) return { success: true, data: null };

        const fs = require('fs');
        const buffer = fs.readFileSync(result.filePath);
        const ext = result.filePath.toLowerCase();
        let mimeType = 'image/png';
        if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (ext.endsWith('.gif')) mimeType = 'image/gif';
        else if (ext.endsWith('.webp')) mimeType = 'image/webp';
        else if (ext.endsWith('.bmp')) mimeType = 'image/bmp';
        else if (ext.endsWith('.svg')) mimeType = 'image/svg+xml';

        const localSrc = saveImageBuffer(itemId, buffer, mimeType);
        return { success: true, data: { localSrc } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );

  ipcMain.handle(
    'editor:saveImageBuffer',
    async (_event, itemId: number, arrayBuffer: number[], mimeType: string): Promise<IpcResult<string>> => {
      try {
        const buffer = Buffer.from(arrayBuffer);
        const localSrc = saveImageBuffer(itemId, buffer, mimeType);
        return { success: true, data: localSrc };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
}
