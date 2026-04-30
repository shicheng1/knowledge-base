import { ipcMain } from 'electron';
import { tagRepo } from '../database/repositories/tag.repo';
import type { IpcResult, Tag, UpdateTagDTO } from '../database/types';

/**
 * Register IPC handlers for tag operations.
 */
export function registerTagHandlers(): void {
  /**
   * Get all tags.
   * Channel: tag:getAll
   * Params: none
   * Returns: IpcResult<Tag[]>
   */
  ipcMain.handle('tag:getAll', async (): Promise<IpcResult<Tag[]>> => {
    try {
      const tags = await tagRepo.findAll();
      return { success: true, data: tags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Create a new tag.
   * Channel: tag:create
   * Params: { name: string, color?: string | null }
   * Returns: IpcResult<number> (the new tag's ID)
   */
  ipcMain.handle('tag:create', async (_event, name: string, color?: string | null): Promise<IpcResult<number>> => {
    try {
      const id = await tagRepo.create(name, color);
      return { success: true, data: id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Update an existing tag.
   * Channel: tag:update
   * Params: { id: number, data: Partial<UpdateTagDTO> }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('tag:update', async (_event, id: number, data: Partial<UpdateTagDTO>): Promise<IpcResult<void>> => {
    try {
      await tagRepo.update(id, data);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Delete a tag by ID.
   * Channel: tag:delete
   * Params: { id: number }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('tag:delete', async (_event, id: number): Promise<IpcResult<void>> => {
    try {
      await tagRepo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get all tags for a specific item.
   * Channel: tag:getByItem
   * Params: { itemId: number }
   * Returns: IpcResult<Tag[]>
   */
  ipcMain.handle('tag:getByItem', async (_event, itemId: number): Promise<IpcResult<Tag[]>> => {
    try {
      const tags = await tagRepo.getByItem(itemId);
      return { success: true, data: tags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Set (replace) all tags for a specific item.
   * Channel: tag:setForItem
   * Params: { itemId: number, tagIds: number[] }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('tag:setForItem', async (_event, itemId: number, tagIds: number[]): Promise<IpcResult<void>> => {
    try {
      await tagRepo.setForItem(itemId, tagIds);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
