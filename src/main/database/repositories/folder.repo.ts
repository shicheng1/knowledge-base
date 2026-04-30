import { query } from '../connection';
import type { ResultSetHeader } from 'mysql2/promise';
import type {
  Folder,
  FolderTreeNode,
  CreateFolderDTO,
  UpdateFolderDTO,
} from '../types';

/**
 * FolderRepository - Data access layer for folders.
 * Supports hierarchical folder tree operations.
 */
export class FolderRepository {
  // ----------------------------------------------------------------
  // Read operations
  // ----------------------------------------------------------------

  /**
   * Get a single folder by its ID.
   */
  async findById(id: number): Promise<Folder | null> {
    try {
      const rows = await query(
        `SELECT * FROM folders WHERE id = ?`,
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      return rows[0] as Folder;
    } catch (error) {
      throw new Error(
        `Failed to find folder by id ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all root-level folders (parent_id IS NULL).
   */
  async findRoots(): Promise<Folder[]> {
    try {
      const rows = await query(
        `SELECT * FROM folders WHERE parent_id IS NULL ORDER BY sort_order ASC, name ASC`,
        []
      );

      return Array.isArray(rows) ? (rows as Folder[]) : [];
    } catch (error) {
      throw new Error(
        `Failed to find root folders: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all direct children of a given folder.
   */
  async findChildren(parentId: number): Promise<Folder[]> {
    try {
      const rows = await query(
        `SELECT * FROM folders WHERE parent_id = ? ORDER BY sort_order ASC, name ASC`,
        [parentId]
      );

      return Array.isArray(rows) ? (rows as Folder[]) : [];
    } catch (error) {
      throw new Error(
        `Failed to find children of folder ${parentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build and return the full folder tree recursively.
   */
  async getTree(): Promise<FolderTreeNode[]> {
    try {
      const rows = await query(
        `SELECT * FROM folders ORDER BY sort_order ASC, name ASC`,
        []
      );

      const folders: Folder[] = Array.isArray(rows) ? (rows as Folder[]) : [];

      // Build a map for quick lookup
      const folderMap = new Map<number, FolderTreeNode>();
      for (const folder of folders) {
        folderMap.set(folder.id, { ...folder, children: [] });
      }

      // Build the tree structure
      const roots: FolderTreeNode[] = [];

      for (const folder of folders) {
        const node = folderMap.get(folder.id)!;

        if (folder.parentId === null) {
          roots.push(node);
        } else {
          const parent = folderMap.get(folder.parentId);
          if (parent) {
            parent.children.push(node);
          } else {
            // Parent not found, treat as root
            roots.push(node);
          }
        }
      }

      return roots;
    } catch (error) {
      throw new Error(
        `Failed to get folder tree: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the full path from root to the specified folder.
   * Returns an array of folders representing the path.
   */
  async getPath(id: number): Promise<Folder[]> {
    try {
      const path: Folder[] = [];
      let currentId: number | null = id;

      // Walk up the tree (max 100 levels to prevent infinite loops)
      let safetyCounter = 0;
      while (currentId !== null && safetyCounter < 100) {
        const rows = await query(
          `SELECT * FROM folders WHERE id = ?`,
          [currentId]
        );

        if (!Array.isArray(rows) || rows.length === 0) {
          break;
        }

        const folder = rows[0] as Folder;
        path.unshift(folder); // Add to the beginning
        currentId = folder.parentId;
        safetyCounter++;
      }

      return path;
    } catch (error) {
      throw new Error(
        `Failed to get path for folder ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ----------------------------------------------------------------
  // Write operations
  // ----------------------------------------------------------------

  /**
   * Create a new folder.
   * Returns the ID of the newly created folder.
   */
  async create(data: CreateFolderDTO): Promise<number> {
    try {
      const result = await query<ResultSetHeader>(
        `INSERT INTO folders (parent_id, name, description, sort_order)
         VALUES (?, ?, ?, ?)`,
        [
          data.parentId ?? null,
          data.name,
          data.description ?? null,
          data.sortOrder ?? 0,
        ]
      );

      const insertId = result.insertId;

      if (typeof insertId !== 'number' || insertId === 0) {
        throw new Error('Failed to retrieve insert ID after folder creation');
      }

      return insertId;
    } catch (error) {
      throw new Error(
        `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update an existing folder. Only provided fields will be updated.
   */
  async update(id: number, data: Partial<UpdateFolderDTO>): Promise<void> {
    try {
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        setClauses.push('name = ?');
        params.push(data.name);
      }
      if (data.parentId !== undefined) {
        setClauses.push('parent_id = ?');
        params.push(data.parentId);
      }
      if (data.description !== undefined) {
        setClauses.push('description = ?');
        params.push(data.description);
      }
      if (data.sortOrder !== undefined) {
        setClauses.push('sort_order = ?');
        params.push(data.sortOrder);
      }

      if (setClauses.length === 0) {
        return; // Nothing to update
      }

      // Always update the updated_at timestamp
      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      params.push(id);

      await query(
        `UPDATE folders SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    } catch (error) {
      throw new Error(
        `Failed to update folder ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a folder by ID.
   * Children folders will have their parent_id set to NULL (become root folders).
   */
  async delete(id: number): Promise<void> {
    try {
      // Set children's parent to null before deleting
      await query(
        `UPDATE folders SET parent_id = NULL WHERE parent_id = ?`,
        [id]
      );

      // Set items in this folder to have no folder
      await query(
        `UPDATE items SET folder_id = NULL WHERE folder_id = ?`,
        [id]
      );

      // Delete the folder
      await query(`DELETE FROM folders WHERE id = ?`, [id]);
    } catch (error) {
      throw new Error(
        `Failed to delete folder ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Move a folder to a new parent.
   */
  async move(id: number, newParentId: number | null): Promise<void> {
    try {
      // Prevent moving a folder into itself or its own descendants
      if (newParentId !== null) {
        const isDescendant = await this.isDescendant(newParentId, id);
        if (isDescendant) {
          throw new Error('Cannot move a folder into its own descendant');
        }
      }

      await query(
        `UPDATE folders SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newParentId, id]
      );
    } catch (error) {
      throw new Error(
        `Failed to move folder ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /**
   * Check if `potentialDescendantId` is a descendant of `ancestorId`.
   */
  private async isDescendant(potentialDescendantId: number, ancestorId: number): Promise<boolean> {
    let currentId: number | null = potentialDescendantId;
    let safetyCounter = 0;

    while (currentId !== null && safetyCounter < 100) {
      if (currentId === ancestorId) {
        return true;
      }

      const rows = await query(
        `SELECT parent_id FROM folders WHERE id = ?`,
        [currentId]
      ) as unknown[];

      if (!Array.isArray(rows) || rows.length === 0) {
        break;
      }

      currentId = (rows[0] as { parent_id: number | null }).parent_id;
      safetyCounter++;
    }

    return false;
  }

  /**
   * Find a folder by name and parent, or create it.
   */
  async createOrGet(dto: { name: string; parentId?: number | null }): Promise<{ id: number; name: string }> {
    try {
      const rows = await query(
        `SELECT id, name FROM folders WHERE name = ? AND parent_id ${dto.parentId ? '= ?' : 'IS NULL'} LIMIT 1`,
        dto.parentId ? [dto.name, dto.parentId] : [dto.name]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] as { id: number; name: string };
      }
      const id = await this.create(dto);
      return { id, name: dto.name };
    } catch (error) {
      throw new Error(
        `Failed to find or create folder: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/** Singleton instance */
export const folderRepo = new FolderRepository();
