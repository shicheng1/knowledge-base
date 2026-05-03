import { ipcMain } from 'electron';
import type { IpcResult } from '../database/types';
import { feedRepo } from '../database/repositories/feed.repo';
import * as feedService from '../services/feed-service';
import { translateFeedItem } from '../services/translate-service';

export function registerFeedHandlers(): void {
  ipcMain.handle('feed:getSources', async (): Promise<IpcResult> => {
    try {
      const sources = await feedRepo.findAll();
      return { success: true, data: sources };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:addSource', async (_event, dto: {
    name: string;
    url: string;
    type: 'rss' | 'github';
    description?: string | null;
    iconUrl?: string | null;
    siteUrl?: string | null;
    category?: string | null;
    enabled?: boolean;
    fetchIntervalMinutes?: number;
  }): Promise<IpcResult<number>> => {
    try {
      const newId = await feedRepo.create(dto);
      if (dto.type === 'rss') {
        await feedService.refreshSource(newId);
      }
      return { success: true, data: newId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:updateSource', async (_event, args: {
    id: number;
    name?: string;
    url?: string;
    description?: string | null;
    iconUrl?: string | null;
    siteUrl?: string | null;
    category?: string | null;
    enabled?: boolean;
    fetchIntervalMinutes?: number;
  }): Promise<IpcResult<boolean>> => {
    try {
      const { id, ...dto } = args;
      const result = await feedRepo.update(id, dto);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:deleteSource', async (_event, args: { id: number }): Promise<IpcResult<boolean>> => {
    try {
      await feedRepo.delete(args.id);
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:batchDeleteSources', async (_event, args: { ids: number[] }): Promise<IpcResult<boolean>> => {
    try {
      await feedRepo.batchDelete(args.ids);
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:toggleSource', async (_event, args: { id: number }): Promise<IpcResult<boolean>> => {
    try {
      const result = await feedRepo.toggleEnabled(args.id);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:getItems', async (_event, options?: {
    page?: number;
    pageSize?: number;
    sourceId?: number | null;
    sourceType?: 'rss' | 'github' | null;
    keyword?: string;
    importedOnly?: boolean;
    unimportedOnly?: boolean;
    starredOnly?: boolean;
  }): Promise<IpcResult> => {
    try {
      const result = await feedRepo.findItems(options || {});
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:importItem', async (_event, args: { feedItemId: number; folderId?: number }): Promise<IpcResult<number>> => {
    try {
      const itemId = await feedService.importFeedItem(args.feedItemId, args.folderId);
      return { success: true, data: itemId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:batchImport', async (_event, args: { feedItemIds: number[]; folderId?: number }): Promise<IpcResult<{ success: number; failed: number; results: Array<{ id: number; itemId?: number; error?: string }> }>> => {
    try {
      const result = await feedService.batchImportFeedItems(args.feedItemIds, args.folderId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:refreshAll', async (): Promise<IpcResult<void>> => {
    try {
      await feedService.refreshAllSources();
      return { success: true, data: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:refreshSource', async (_event, args: { sourceId: number }): Promise<IpcResult<void>> => {
    try {
      await feedService.refreshSource(args.sourceId);
      return { success: true, data: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:syncGitHubTrending', async (): Promise<IpcResult> => {
    try {
      const existing = await feedRepo.findByType('github');
      let sourceId: number;

      if (existing.length > 0) {
        sourceId = existing[0].id;
      } else {
        sourceId = await feedRepo.create({
          name: 'GitHub Trending (Weekly)',
          url: 'https://github.com/trending?since=weekly',
          type: 'github',
        });
      }

      await feedService.refreshSource(sourceId);
      return { success: true, data: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:translateItem', async (_event, args: { feedItemId: number }): Promise<IpcResult> => {
    try {
      const result = await translateFeedItem(args.feedItemId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('feed:getPresetSources', async (): Promise<IpcResult> => {
    try {
      const presets = feedService.getPresetSources();
      return { success: true, data: presets };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('feed:importOpml', async (_event, args: { content: string }): Promise<IpcResult> => {
    try {
      const result = await feedService.parseOpmlAndImport(args.content);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('feed:toggleStar', async (_event, args: { id: number }): Promise<IpcResult<boolean>> => {
    try {
      await feedRepo.toggleStar(args.id);
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('feed:extractContent', async (_event, args: { url: string }): Promise<IpcResult<any>> => {
    try {
      const { extractFromUrl } = await import('../services/content-extractor');
      const content = await extractFromUrl(args.url);
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
