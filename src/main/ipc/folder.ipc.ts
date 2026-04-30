import { ipcMain } from 'electron';
import { folderRepo } from '../database/repositories/folder.repo';
import type {
  IpcResult,
  Folder,
  FolderTreeNode,
  CreateFolderDTO,
  UpdateFolderDTO,
} from '../database/types';

/**
 * Register IPC handlers for folder operations.
 */
export function registerFolderHandlers(): void {
  /**
   * Get the full folder tree.
   * Channel: folder:getTree
   * Params: none
   * Returns: IpcResult<FolderTreeNode[]>
   */
  ipcMain.handle('folder:getTree', async (): Promise<IpcResult<FolderTreeNode[]>> => {
    try {
      const tree = await folderRepo.getTree();
      return { success: true, data: tree };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get a single folder by ID.
   * Channel: folder:getById
   * Params: { id: number }
   * Returns: IpcResult<Folder | null>
   */
  ipcMain.handle('folder:getById', async (_event, id: number): Promise<IpcResult<Folder | null>> => {
    try {
      const folder = await folderRepo.findById(id);
      return { success: true, data: folder };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Create a new folder.
   * Channel: folder:create
   * Params: CreateFolderDTO
   * Returns: IpcResult<number> (the new folder's ID)
   */
  ipcMain.handle('folder:create', async (_event, data: CreateFolderDTO): Promise<IpcResult<number>> => {
    try {
      const id = await folderRepo.create(data);
      return { success: true, data: id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Update an existing folder.
   * Channel: folder:update
   * Params: { id: number, data: Partial<UpdateFolderDTO> }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('folder:update', async (_event, id: number, data: Partial<UpdateFolderDTO>): Promise<IpcResult<void>> => {
    try {
      await folderRepo.update(id, data);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Delete a folder by ID.
   * Children folders become root folders.
   * Channel: folder:delete
   * Params: { id: number }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('folder:delete', async (_event, id: number): Promise<IpcResult<void>> => {
    try {
      await folderRepo.delete(id);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Move a folder to a new parent.
   * Channel: folder:move
   * Params: { id: number, newParentId: number | null }
   * Returns: IpcResult<void>
   */
  ipcMain.handle('folder:move', async (_event, id: number, newParentId: number | null): Promise<IpcResult<void>> => {
    try {
      await folderRepo.move(id, newParentId);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
