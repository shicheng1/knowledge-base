import { ipcMain } from 'electron';
import { itemRepo } from '../database/repositories/item.repo';
import { linkRepo } from '../database/repositories/link.repo';
import { revisionRepo } from '../database/repositories/revision.repo';
import { exportItemAsMarkdown, exportItemAsJSON, batchExportAsZip } from '../services/export-service';
import type { IpcResult, CreateItemDTO, UpdateItemDTO, QueryOptions, Item, PaginatedResult, ItemStats, ItemLink } from '../database/types';
import type { ItemRevision } from '../database/repositories/revision.repo';

/**
 * Parse [[title]] patterns from content and create item links.
 */
async function syncLinksFromContent(itemId: number, content: string | null | undefined): Promise<void> {
  if (!content) {
    // No content → remove all outlinks
    await linkRepo.deleteRemovedLinks(itemId, []);
    return;
  }

  // Match [[title]] - supports Chinese/English alphanumeric titles
  const linkPattern = /\[\[([^\]]+)\]\]/g;
  const titles = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content)) !== null) {
    titles.add(match[1].trim());
  }

  if (titles.size === 0) {
    await linkRepo.deleteRemovedLinks(itemId, []);
    return;
  }

  // Resolve titles to item IDs
  const targetIds: number[] = [];
  for (const title of titles) {
    const found = await linkRepo.findItemByTitle(title);
    if (found.length > 0) {
      targetIds.push(found[0].id);
    }
  }

  // Remove links no longer present, then insert current ones
  await linkRepo.deleteRemovedLinks(itemId, targetIds);
  if (targetIds.length > 0) {
    const links = targetIds.map((targetId) => ({
      sourceItemId: itemId,
      targetItemId: targetId,
    }));
    await linkRepo.createLinks(links);
  }
}

/**
 * Register IPC handlers for item operations.
 */
export function registerItemHandlers(): void {
  /**
   * Get a single item by ID.
   * Channel: item:getById
   * Params: { id: number }
   * Returns: IpcResult<Item | null>
   */
  ipcMain.handle('item:getById', async (_event, id: number): Promise<IpcResult<Item | null>> => {
    try {
      const item = await itemRepo.findById(id);
      return { success: true, data: item };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get a paginated list of items with optional filters.
   * Channel: item:getList
   * Params: QueryOptions
   * Returns: IpcResult<PaginatedResult<Item>>
   */
  ipcMain.handle('item:getList', async (_event, options: QueryOptions): Promise<IpcResult<PaginatedResult<Item>>> => {
    try {
      const result = await itemRepo.findAll(options);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Create a new item.
   * Channel: item:create
   * Params: CreateItemDTO
   * Returns: IpcResult<number> (the new item's ID)
   */
  ipcMain.handle('item:create', async (_event, data: CreateItemDTO): Promise<IpcResult<number>> => {
    try {
      const id = await itemRepo.create(data);
      // Sync links from content
      await syncLinksFromContent(id, data.content);
      return { success: true, data: id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Update an existing item.
   * Channel: item:update
   * Params: { id: number, data: Partial<UpdateItemDTO> }
   * Returns: IpcResult<Item | null>
   */
  ipcMain.handle('item:update', async (_event, id: number, data: Partial<UpdateItemDTO>): Promise<IpcResult<Item | null>> => {
    try {
      // Capture current state as revision if content is changing
      if (data.content !== undefined) {
        const current = await itemRepo.findById(id);
        if (current) {
          await revisionRepo.maybeCreateRevision(id, current.title, current.content);
        }
      }

      await itemRepo.update(id, data);
      const updated = await itemRepo.findById(id);
      // Sync links if content changed
      if (data.content !== undefined) {
        await syncLinksFromContent(id, data.content);
      }
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Delete an item by ID (soft delete).
   * Channel: item:delete
   * Params: { id: number }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('item:delete', async (_event, id: number): Promise<IpcResult<void>> => {
    try {
      await itemRepo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Restore a soft-deleted item.
   * Channel: item:restore
   * Params: { id: number }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('item:restore', async (_event, id: number): Promise<IpcResult<void>> => {
    try {
      await itemRepo.restore(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Permanently delete an item.
   * Channel: item:permanentDelete
   * Params: { id: number }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('item:permanentDelete', async (_event, id: number): Promise<IpcResult<void>> => {
    try {
      await itemRepo.permanentDelete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get soft-deleted items (trash list) with pagination.
   * Channel: item:getTrashList
   * Params: { page?: number, pageSize?: number }
   * Returns: IpcResult<PaginatedResult<Item>>
   */
  ipcMain.handle('item:getTrashList', async (_event, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PaginatedResult<Item>>> => {
    try {
      const result = await itemRepo.findDeleted(options);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Empty the trash (permanently delete all soft-deleted items).
   * Channel: item:emptyTrash
   * Params: none
   * Returns: IpcResult<number> (number of permanently deleted items)
   */
  ipcMain.handle('item:emptyTrash', async (): Promise<IpcResult<number>> => {
    try {
      const count = await itemRepo.emptyTrash();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Batch delete items by IDs.
   * Channel: item:batchDelete
   * Params: { ids: number[] }
   * Returns: IpcResult<number> (number of deleted rows)
   */
  ipcMain.handle('item:batchDelete', async (_event, ids: number[]): Promise<IpcResult<number>> => {
    try {
      const count = await itemRepo.batchDelete(ids);
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Search items using FULLTEXT search with pagination and relevance sorting.
   * Channel: item:search
   * Params: { keyword: string, options?: { page?: number, pageSize?: number } }
   * Returns: IpcResult<PaginatedResult<Item>>
   */
  ipcMain.handle('item:search', async (_event, keyword: string, options?: { page?: number; pageSize?: number }): Promise<IpcResult<PaginatedResult<Item>>> => {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return { success: true, data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } };
      }
      const result = await itemRepo.search(keyword.trim(), options);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get search suggestions based on title prefix matching.
   * Channel: item:searchSuggestions
   * Params: { keyword: string }
   * Returns: IpcResult<Array<{ id: number; title: string }>>
   */
  ipcMain.handle('item:searchSuggestions', async (_event, keyword: string): Promise<IpcResult<Array<{ id: number; title: string }>>> => {
    try {
      if (!keyword || keyword.trim().length === 0) {
        return { success: true, data: [] };
      }
      const suggestions = await itemRepo.searchSuggestions(keyword.trim());
      return { success: true, data: suggestions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Toggle the favorite status of an item.
   * Channel: item:toggleFavorite
   * Params: { id: number }
   * Returns: IpcResult<boolean> (the new favorite state)
   */
  ipcMain.handle('item:toggleFavorite', async (_event, id: number): Promise<IpcResult<boolean>> => {
    try {
      const isFavorite = await itemRepo.toggleFavorite(id);
      return { success: true, data: isFavorite };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('item:togglePin', async (_event, id: number): Promise<IpcResult<boolean>> => {
    try {
      const isPinned = await itemRepo.togglePin(id);
      return { success: true, data: isPinned };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get aggregate statistics about items.
   * Channel: item:getStats
   * Params: none
   * Returns: IpcResult<ItemStats>
   */
  ipcMain.handle('item:getStats', async (): Promise<IpcResult<ItemStats>> => {
    try {
      const stats = await itemRepo.getStats();
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get dashboard statistics (rich stats for charts).
   * Channel: item:getDashboardStats
   */
  ipcMain.handle('item:getDashboardStats', async (): Promise<IpcResult<any>> => {
    try {
      const stats = await itemRepo.getDashboardStats();
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Export a single item as Markdown.
   * Channel: item:exportMarkdown
   * Params: { id: number }
   * Returns: IpcResult<{ success: boolean; path?: string; error?: string }>
   */
  ipcMain.handle('item:exportMarkdown', async (_event, id: number): Promise<IpcResult<{ success: boolean; path?: string; error?: string }>> => {
    try {
      const result = await exportItemAsMarkdown(id);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Export a single item as JSON.
   * Channel: item:exportJSON
   * Params: { id: number }
   * Returns: IpcResult<{ success: boolean; path?: string; error?: string }>
   */
  ipcMain.handle('item:exportJSON', async (_event, id: number): Promise<IpcResult<{ success: boolean; path?: string; error?: string }>> => {
    try {
      const result = await exportItemAsJSON(id);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Batch export items as ZIP.
   * Channel: item:batchExport
   * Params: { ids: number[] }
   * Returns: IpcResult<{ success: boolean; path?: string; error?: string }>
   */
  ipcMain.handle('item:batchExport', async (_event, ids: number[]): Promise<IpcResult<{ success: boolean; path?: string; error?: string }>> => {
    try {
      const result = await batchExportAsZip(ids);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get backlinks for an item (items that link TO this item).
   * Channel: item:getBacklinks
   */
  ipcMain.handle('item:getBacklinks', async (_event, id: number): Promise<IpcResult<ItemLink[]>> => {
    try {
      const backlinks = await linkRepo.getBacklinks(id);
      return { success: true, data: backlinks };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get outlinks for an item (items that this item links TO).
   * Channel: item:getOutlinks
   */
  ipcMain.handle('item:getOutlinks', async (_event, id: number): Promise<IpcResult<ItemLink[]>> => {
    try {
      const outlinks = await linkRepo.getOutlinks(id);
      return { success: true, data: outlinks };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get revisions for an item.
   * Channel: item:getRevisions
   */
  ipcMain.handle('item:getRevisions', async (_event, id: number): Promise<IpcResult<ItemRevision[]>> => {
    try {
      const revisions = await revisionRepo.getRevisions(id);
      return { success: true, data: revisions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Restore a revision: update the item's content to match the revision.
   * Channel: item:restoreRevision
   */
  ipcMain.handle('item:restoreRevision', async (_event, revisionId: number): Promise<IpcResult<Item | null>> => {
    try {
      const revision = await revisionRepo.getRevision(revisionId);
      if (!revision) {
        return { success: false, error: 'Revision not found' };
      }
      await itemRepo.update(revision.itemId, { content: revision.content, title: revision.title ?? undefined });
      const updated = await itemRepo.findById(revision.itemId);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get all template items.
   * Channel: item:getTemplates
   */
  ipcMain.handle('item:getTemplates', async (): Promise<IpcResult<Item[]>> => {
    try {
      const templates = await itemRepo.getTemplates();
      return { success: true, data: templates };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
