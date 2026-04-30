import { ipcMain } from 'electron';
import { archiveFullPage } from '../services/full-archiver.service';
import { itemRepo } from '../database/repositories/item.repo';
import type { IpcResult } from '../database/types';

export function registerArchiveHandlers(): void {
  /**
   * 抓取完整网页（内联 CSS+图片，移除 script），创建条目。
   * Channel: archive:fromUrl
   */
  ipcMain.handle(
    'archive:fromUrl',
    async (_event, url: string, folderId?: number | null): Promise<IpcResult<{ id: number; title: string }>> => {
      try {
        if (!url || !/^https?:\/\//i.test(url)) {
          return { success: false, error: '无效的 URL' };
        }
        const result = await archiveFullPage(url);
        const id = await itemRepo.create({
          title: result.title || url,
          content: result.textContent.slice(0, 50000),
          contentHtml: result.html,
          contentType: 'article',
          sourceUrl: url,
          sourceType: 'web',
          sourceName: result.title,
          folderId: folderId ?? null,
          metadata: { archive: 'full' },
        });
        return { success: true, data: { id, title: result.title || url } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
}
