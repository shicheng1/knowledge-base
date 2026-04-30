import { query } from '../connection';
import type { ResultSetHeader } from 'mysql2/promise';
import type {
  Item,
  CreateItemDTO,
  UpdateItemDTO,
  QueryOptions,
  PaginatedResult,
  ItemStats,
  ContentType,
} from '../types';

/**
 * ItemRepository - Data access layer for knowledge items.
 * All methods use parameterized queries via the shared `query` function.
 */
export class ItemRepository {
  // ----------------------------------------------------------------
  // Read operations
  // ----------------------------------------------------------------

  /**
   * Get a single item by its ID, including associated tags.
   */
  async findById(id: number): Promise<Item | null> {
    try {
      const rows = await query(
        `SELECT i.* FROM items i WHERE i.id = ? AND i.deleted_at IS NULL`,
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      const item = rows[0] as Item;

      // Fetch tags for this item
      const tagRows = await query(
        `SELECT t.* FROM tags t
         INNER JOIN item_tags it ON t.id = it.tag_id
         WHERE it.item_id = ?`,
        [id]
      );

      item.tags = Array.isArray(tagRows) ? (tagRows as Item['tags']) : [];
      return item;
    } catch (error) {
      throw new Error(
        `Failed to find item by id ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a paginated, filtered, and sorted list of items.
   */
  async findAll(options: QueryOptions): Promise<PaginatedResult<Item>> {
    try {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      // Build WHERE clauses
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (!options.includeDeleted) {
        conditions.push('i.deleted_at IS NULL');
      }

      if (options.folderId !== undefined && options.folderId !== null) {
        conditions.push('i.folder_id = ?');
        params.push(options.folderId);
      }

      if (options.contentType) {
        conditions.push('i.content_type = ?');
        params.push(options.contentType);
      }

      if (options.isFavorite !== undefined) {
        conditions.push('i.is_favorite = ?');
        params.push(options.isFavorite ? 1 : 0);
      }

      if (options.isArchived !== undefined) {
        conditions.push('i.is_archived = ?');
        params.push(options.isArchived ? 1 : 0);
      }

      if (options.dateRange) {
        conditions.push('i.created_at >= ?');
        params.push(options.dateRange.start);
        conditions.push('i.created_at <= ?');
        params.push(options.dateRange.end);
      }

      if (options.tagId) {
        conditions.push(
          `i.id IN (SELECT item_id FROM item_tags WHERE tag_id = ?)`
        );
        params.push(options.tagId);
      }

      if (options.keyword) {
        conditions.push(
          `(i.title LIKE ? OR i.content LIKE ? OR i.summary LIKE ?)`
        );
        const keywordPattern = `%${options.keyword}%`;
        params.push(keywordPattern, keywordPattern, keywordPattern);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Determine sort
      const sortField = this.mapSortField(options.sort?.field ?? 'createdAt');
      const sortDirection = options.sort?.direction ?? 'DESC';
      const orderBy = `ORDER BY i.is_pinned DESC, i.${sortField} ${sortDirection}`;

      // Count total
      const countRows = await query(
        `SELECT COUNT(*) as total FROM items i ${whereClause}`,
        params
      );
      const total = Array.isArray(countRows) && countRows.length > 0
        ? Number((countRows[0] as { total: number }).total)
        : 0;

      // Fetch page (LIMIT/OFFSET 不能用预处理参数，直接拼入 SQL)
      const safeLimit = Number(pageSize) || 20;
      const safeOffset = Number(offset) || 0;
      const dataRows = await query(
        `SELECT i.* FROM items i ${whereClause} ${orderBy} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params
      );

      const items: Item[] = Array.isArray(dataRows) ? (dataRows as Item[]) : [];

      // Fetch tags for all items in this page
      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const placeholders = itemIds.map(() => '?').join(',');

        const tagRows = await query(
          `SELECT it.item_id, t.id, t.name, t.color, t.created_at
           FROM item_tags it
           INNER JOIN tags t ON it.tag_id = t.id
           WHERE it.item_id IN (${placeholders})`,
          itemIds
        );

        const tagMap = new Map<number, Item['tags']>();
        if (Array.isArray(tagRows)) {
          for (const row of tagRows as Array<{
            item_id: number;
            id: number;
            name: string;
            color: string | null;
            created_at: string;
          }>) {
            if (!tagMap.has(row.item_id)) {
              tagMap.set(row.item_id, []);
            }
            tagMap.get(row.item_id)!.push({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            });
          }
        }

        for (const item of items) {
          item.tags = tagMap.get(item.id) ?? [];
        }
      }

      return {
        data: items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw new Error(
        `Failed to find items: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all items in a specific folder.
   */
  async findByFolder(folderId: number): Promise<Item[]> {
    try {
      const rows = await query(
        `SELECT i.* FROM items i WHERE i.folder_id = ? AND i.deleted_at IS NULL ORDER BY i.is_pinned DESC, i.created_at DESC`,
        [folderId]
      );

      const items: Item[] = Array.isArray(rows) ? (rows as Item[]) : [];

      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const placeholders = itemIds.map(() => '?').join(',');

        const tagRows = await query(
          `SELECT it.item_id, t.id, t.name, t.color, t.created_at
           FROM item_tags it
           INNER JOIN tags t ON it.tag_id = t.id
           WHERE it.item_id IN (${placeholders})`,
          itemIds
        );

        const tagMap = new Map<number, Item['tags']>();
        if (Array.isArray(tagRows)) {
          for (const row of tagRows as Array<{
            item_id: number;
            id: number;
            name: string;
            color: string | null;
            created_at: string;
          }>) {
            if (!tagMap.has(row.item_id)) {
              tagMap.set(row.item_id, []);
            }
            tagMap.get(row.item_id)!.push({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            });
          }
        }

        for (const item of items) {
          item.tags = tagMap.get(item.id) ?? [];
        }
      }

      return items;
    } catch (error) {
      throw new Error(
        `Failed to find items by folder ${folderId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get items created within a date range.
   */
  async findByDateRange(start: string, end: string): Promise<Item[]> {
    try {
      const rows = await query(
        `SELECT i.* FROM items i
         WHERE i.created_at >= ? AND i.created_at <= ? AND i.deleted_at IS NULL
         ORDER BY i.created_at DESC`,
        [start, end]
      );

      const items: Item[] = Array.isArray(rows) ? (rows as Item[]) : [];

      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const placeholders = itemIds.map(() => '?').join(',');

        const tagRows = await query(
          `SELECT it.item_id, t.id, t.name, t.color, t.created_at
           FROM item_tags it
           INNER JOIN tags t ON it.tag_id = t.id
           WHERE it.item_id IN (${placeholders})`,
          itemIds
        );

        const tagMap = new Map<number, Item['tags']>();
        if (Array.isArray(tagRows)) {
          for (const row of tagRows as Array<{
            item_id: number;
            id: number;
            name: string;
            color: string | null;
            created_at: string;
          }>) {
            if (!tagMap.has(row.item_id)) {
              tagMap.set(row.item_id, []);
            }
            tagMap.get(row.item_id)!.push({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            });
          }
        }

        for (const item of items) {
          item.tags = tagMap.get(item.id) ?? [];
        }
      }

      return items;
    } catch (error) {
      throw new Error(
        `Failed to find items by date range: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get items associated with a specific tag.
   */
  async findByTag(tagId: number): Promise<Item[]> {
    try {
      const rows = await query(
        `SELECT i.* FROM items i
         INNER JOIN item_tags it ON i.id = it.item_id
         WHERE it.tag_id = ? AND i.deleted_at IS NULL
         ORDER BY i.created_at DESC`,
        [tagId]
      );

      const items: Item[] = Array.isArray(rows) ? (rows as Item[]) : [];

      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const placeholders = itemIds.map(() => '?').join(',');

        const tagRows = await query(
          `SELECT it.item_id, t.id, t.name, t.color, t.created_at
           FROM item_tags it
           INNER JOIN tags t ON it.tag_id = t.id
           WHERE it.item_id IN (${placeholders})`,
          itemIds
        );

        const tagMap = new Map<number, Item['tags']>();
        if (Array.isArray(tagRows)) {
          for (const row of tagRows as Array<{
            item_id: number;
            id: number;
            name: string;
            color: string | null;
            created_at: string;
          }>) {
            if (!tagMap.has(row.item_id)) {
              tagMap.set(row.item_id, []);
            }
            tagMap.get(row.item_id)!.push({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            });
          }
        }

        for (const item of items) {
          item.tags = tagMap.get(item.id) ?? [];
        }
      }

      return items;
    } catch (error) {
      throw new Error(
        `Failed to find items by tag ${tagId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * FULLTEXT search using MATCH...AGAINST with ngram parser.
   * Searches across title, content, and summary fields.
   */
  async search(keyword: string, options: { page?: number; pageSize?: number } = {}): Promise<PaginatedResult<Item>> {
    try {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const countRows = await query(
        `SELECT COUNT(*) as total FROM items i
         WHERE MATCH(i.title, i.content, i.summary) AGAINST(? IN BOOLEAN MODE)
         AND i.deleted_at IS NULL`,
        [keyword]
      );
      const total = Array.isArray(countRows) && countRows.length > 0
        ? Number((countRows[0] as { total: number }).total)
        : 0;

      const safeLimit = Number(pageSize) || 20;
      const safeOffset = Number(offset) || 0;
      const dataRows = await query(
        `SELECT i.*, MATCH(i.title, i.content, i.summary) AGAINST(? IN BOOLEAN MODE) as relevance_score
         FROM items i
         WHERE MATCH(i.title, i.content, i.summary) AGAINST(? IN BOOLEAN MODE)
         AND i.deleted_at IS NULL
         ORDER BY relevance_score DESC, i.created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [keyword, keyword]
      );

      const items: Item[] = Array.isArray(dataRows) ? (dataRows as Item[]) : [];

      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const placeholders = itemIds.map(() => '?').join(',');

        const tagRows = await query(
          `SELECT it.item_id, t.id, t.name, t.color, t.created_at
           FROM item_tags it
           INNER JOIN tags t ON it.tag_id = t.id
           WHERE it.item_id IN (${placeholders})`,
          itemIds
        );

        const tagMap = new Map<number, Item['tags']>();
        if (Array.isArray(tagRows)) {
          for (const row of tagRows as Array<{
            item_id: number;
            id: number;
            name: string;
            color: string | null;
            created_at: string;
          }>) {
            if (!tagMap.has(row.item_id)) {
              tagMap.set(row.item_id, []);
            }
            tagMap.get(row.item_id)!.push({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            });
          }
        }

        for (const item of items) {
          item.tags = tagMap.get(item.id) ?? [];
        }
      }

      return {
        data: items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw new Error(
        `Failed to search items: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async searchSuggestions(keyword: string, limit: number = 10): Promise<Array<{ id: number; title: string }>> {
    try {
      const rows = await query(
        `SELECT id, title FROM items
         WHERE title LIKE ? AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
        [`%${keyword}%`, limit]
      );
      return Array.isArray(rows) ? (rows as Array<{ id: number; title: string }>) : [];
    } catch (error) {
      throw new Error(
        `Failed to get search suggestions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ----------------------------------------------------------------
  // Write operations
  // ----------------------------------------------------------------

  /**
   * Create a new item and optionally associate tags.
   * Returns the ID of the newly created item.
   */
  async create(data: CreateItemDTO): Promise<number> {
    try {
      const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

      const result = await query<ResultSetHeader>(
        `INSERT INTO items (
          title, content, content_html, summary, content_type,
          source_url, source_type, source_name, file_path, file_size,
          mime_type, folder_id, is_favorite, is_archived, is_template, template_category, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.title,
          data.content ?? null,
          data.contentHtml ?? null,
          data.summary ?? null,
          data.contentType,
          data.sourceUrl ?? null,
          data.sourceType ?? 'manual',
          data.sourceName ?? null,
          data.filePath ?? null,
          data.fileSize ?? null,
          data.mimeType ?? null,
          data.folderId ?? null,
          data.isFavorite ? 1 : 0,
          data.isArchived ? 1 : 0,
          data.isTemplate ? 1 : 0,
          data.templateCategory ?? null,
          metadataJson,
        ]
      );

      // Extract the insert id from the result
      const insertId = result.insertId;

      if (typeof insertId !== 'number' || insertId === 0) {
        throw new Error('Failed to retrieve insert ID after item creation');
      }

      // Associate tags if provided
      if (data.tagIds && data.tagIds.length > 0) {
        await this.setItemTags(insertId, data.tagIds);
      }

      return insertId;
    } catch (error) {
      throw new Error(
        `Failed to create item: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update an existing item. Only provided fields will be updated.
   */
  async update(id: number, data: Partial<UpdateItemDTO>): Promise<void> {
    try {
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (data.title !== undefined) {
        setClauses.push('title = ?');
        params.push(data.title);
      }
      if (data.content !== undefined) {
        setClauses.push('content = ?');
        params.push(data.content);
      }
      if (data.contentHtml !== undefined) {
        setClauses.push('content_html = ?');
        params.push(data.contentHtml);
      }
      if (data.summary !== undefined) {
        setClauses.push('summary = ?');
        params.push(data.summary);
      }
      if (data.contentType !== undefined) {
        setClauses.push('content_type = ?');
        params.push(data.contentType);
      }
      if (data.sourceUrl !== undefined) {
        setClauses.push('source_url = ?');
        params.push(data.sourceUrl);
      }
      if (data.sourceType !== undefined) {
        setClauses.push('source_type = ?');
        params.push(data.sourceType);
      }
      if (data.sourceName !== undefined) {
        setClauses.push('source_name = ?');
        params.push(data.sourceName);
      }
      if (data.filePath !== undefined) {
        setClauses.push('file_path = ?');
        params.push(data.filePath);
      }
      if (data.fileSize !== undefined) {
        setClauses.push('file_size = ?');
        params.push(data.fileSize);
      }
      if (data.mimeType !== undefined) {
        setClauses.push('mime_type = ?');
        params.push(data.mimeType);
      }
      if (data.folderId !== undefined) {
        setClauses.push('folder_id = ?');
        params.push(data.folderId);
      }
      if (data.isFavorite !== undefined) {
        setClauses.push('is_favorite = ?');
        params.push(data.isFavorite ? 1 : 0);
      }
      if (data.isArchived !== undefined) {
        setClauses.push('is_archived = ?');
        params.push(data.isArchived ? 1 : 0);
      }
      if (data.isTemplate !== undefined) {
        setClauses.push('is_template = ?');
        params.push(data.isTemplate ? 1 : 0);
      }
      if (data.templateCategory !== undefined) {
        setClauses.push('template_category = ?');
        params.push(data.templateCategory);
      }
      if (data.metadata !== undefined) {
        setClauses.push('metadata = ?');
        params.push(data.metadata ? JSON.stringify(data.metadata) : null);
      }

      if (setClauses.length === 0) {
        return; // Nothing to update
      }

      // Always update the updated_at timestamp
      setClauses.push('updated_at = CURRENT_TIMESTAMP');

      params.push(id);

      await query(
        `UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );

      // Update tags if provided
      if (data.tagIds !== undefined) {
        await this.setItemTags(id, data.tagIds);
      }
    } catch (error) {
      throw new Error(
        `Failed to update item ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Soft delete an item by ID. Sets deleted_at timestamp.
   */
  async delete(id: number): Promise<void> {
    try {
      await query(
        `UPDATE items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );
    } catch (error) {
      throw new Error(
        `Failed to soft delete item ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Restore a soft-deleted item by ID.
   */
  async restore(id: number): Promise<void> {
    try {
      await query(
        `UPDATE items SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );
    } catch (error) {
      throw new Error(
        `Failed to restore item ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Permanently delete an item by ID. Removes from database entirely.
   */
  async permanentDelete(id: number): Promise<void> {
    try {
      await query(`DELETE FROM item_tags WHERE item_id = ?`, [id]);
      await query(`DELETE FROM attachments WHERE item_id = ?`, [id]);
      await query(`DELETE FROM items WHERE id = ?`, [id]);
    } catch (error) {
      throw new Error(
        `Failed to permanently delete item ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch soft delete items by IDs.
   */
  async batchDelete(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    try {
      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE items SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
        ids
      );
      return ids.length;
    } catch (error) {
      throw new Error(
        `Failed to batch soft delete items: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get soft-deleted items (trash) with pagination.
   */
  async findDeleted(options: { page?: number; pageSize?: number } = {}): Promise<PaginatedResult<Item>> {
    try {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const countRows = await query(
        `SELECT COUNT(*) as total FROM items WHERE deleted_at IS NOT NULL`,
        []
      );
      const total = Array.isArray(countRows) && countRows.length > 0
        ? Number((countRows[0] as { total: number }).total)
        : 0;

      const safeLimit = Number(pageSize) || 20;
      const safeOffset = Number(offset) || 0;
      const dataRows = await query(
        `SELECT * FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        []
      );

      const items: Item[] = Array.isArray(dataRows) ? (dataRows as Item[]) : [];

      if (items.length > 0) {
        const itemIds = items.map((item) => item.id);
        const placeholders = itemIds.map(() => '?').join(',');

        const tagRows = await query(
          `SELECT it.item_id, t.id, t.name, t.color, t.created_at
           FROM item_tags it
           INNER JOIN tags t ON it.tag_id = t.id
           WHERE it.item_id IN (${placeholders})`,
          itemIds
        );

        const tagMap = new Map<number, Item['tags']>();
        if (Array.isArray(tagRows)) {
          for (const row of tagRows as Array<{
            item_id: number;
            id: number;
            name: string;
            color: string | null;
            created_at: string;
          }>) {
            if (!tagMap.has(row.item_id)) {
              tagMap.set(row.item_id, []);
            }
            tagMap.get(row.item_id)!.push({
              id: row.id,
              name: row.name,
              color: row.color,
              createdAt: row.created_at,
            });
          }
        }

        for (const item of items) {
          item.tags = tagMap.get(item.id) ?? [];
        }
      }

      return {
        data: items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw new Error(
        `Failed to find deleted items: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Empty the trash by permanently deleting all soft-deleted items.
   */
  async emptyTrash(): Promise<number> {
    try {
      const deletedRows = await query(
        `SELECT id FROM items WHERE deleted_at IS NOT NULL`,
        []
      );

      if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
        return 0;
      }

      const ids = (deletedRows as Array<{ id: number }>).map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');

      await query(`DELETE FROM item_tags WHERE item_id IN (${placeholders})`, ids);
      await query(`DELETE FROM attachments WHERE item_id IN (${placeholders})`, ids);
      await query(`DELETE FROM items WHERE id IN (${placeholders})`, ids);

      return ids.length;
    } catch (error) {
      throw new Error(
        `Failed to empty trash: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Toggle the is_favorite flag for an item.
   */
  async toggleFavorite(id: number): Promise<boolean> {
    try {
      const rows = await query(
        `SELECT is_favorite FROM items WHERE id = ? AND deleted_at IS NULL`,
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(`Item with id ${id} not found`);
      }

      const currentFavorite = Boolean((rows[0] as { is_favorite: number }).is_favorite);
      const newFavorite = currentFavorite ? 0 : 1;

      await query(
        `UPDATE items SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newFavorite, id]
      );

      return !currentFavorite;
    } catch (error) {
      throw new Error(
        `Failed to toggle favorite for item ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async togglePin(id: number): Promise<boolean> {
    try {
      const rows = await query(
        `SELECT is_pinned FROM items WHERE id = ? AND deleted_at IS NULL`,
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(`Item with id ${id} not found`);
      }

      const currentPinned = Boolean((rows[0] as { is_pinned: number }).is_pinned);
      const newPinned = currentPinned ? 0 : 1;

      await query(
        `UPDATE items SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newPinned, id]
      );

      return !currentPinned;
    } catch (error) {
      throw new Error(
        `Failed to toggle pin for item ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get aggregate statistics about items.
   */
  async getStats(): Promise<ItemStats> {
    try {
      // Total count
      const totalRows = await query(`SELECT COUNT(*) as total FROM items WHERE deleted_at IS NULL`, []);
      const total = Array.isArray(totalRows) && totalRows.length > 0
        ? Number((totalRows[0] as { total: number }).total)
        : 0;

      const typeRows = await query(
        `SELECT content_type, COUNT(*) as count FROM items WHERE deleted_at IS NULL GROUP BY content_type`,
        []
      );

      const byType = {} as Record<ContentType, number>;
      const contentTypes: ContentType[] = [
        'note', 'article', 'bookmark', 'file', 'code', 'image', 'other',
      ];
      for (const ct of contentTypes) {
        byType[ct] = 0;
      }

      if (Array.isArray(typeRows)) {
        for (const row of typeRows as Array<{ content_type: ContentType; count: number }>) {
          byType[row.content_type] = Number(row.count);
        }
      }

      // Favorites count
      const favRows = await query(
        `SELECT COUNT(*) as count FROM items WHERE is_favorite = 1 AND deleted_at IS NULL`,
        []
      );
      const favorites = Array.isArray(favRows) && favRows.length > 0
        ? Number((favRows[0] as { count: number }).count)
        : 0;

      const archivedRows = await query(
        `SELECT COUNT(*) as count FROM items WHERE is_archived = 1 AND deleted_at IS NULL`,
        []
      );
      const archived = Array.isArray(archivedRows) && archivedRows.length > 0
        ? Number((archivedRows[0] as { count: number }).count)
        : 0;

      const recentRows = await query(
        `SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
        []
      );
      const recentItems: Item[] = Array.isArray(recentRows) ? (recentRows as Item[]) : [];

      return {
        total,
        byType,
        favorites,
        archived,
        recentItems,
      };
    } catch (error) {
      throw new Error(
        `Failed to get item stats: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get dashboard statistics (rich stats for visualization).
   */
  async getDashboardStats(): Promise<{
    total: number;
    byType: Record<ContentType, number>;
    bySource: Record<string, number>;
    favorites: number;
    archived: number;
    totalFolders: number;
    totalTags: number;
    weeklyNew: number;
    monthlyTrend: Array<{ month: string; count: number }>;
    tagUsage: Array<{ name: string; color: string | null; count: number }>;
  }> {
    try {
      const totalRows = await query(`SELECT COUNT(*) as total FROM items WHERE deleted_at IS NULL`, []);
      const total = Array.isArray(totalRows) && totalRows.length > 0
        ? Number((totalRows[0] as { total: number }).total)
        : 0;

      // By content type
      const typeRows = await query(
        `SELECT content_type, COUNT(*) as count FROM items WHERE deleted_at IS NULL GROUP BY content_type`,
        []
      );
      const byType = {} as Record<ContentType, number>;
      const contentTypes: ContentType[] = ['note', 'article', 'bookmark', 'file', 'code', 'image', 'other'];
      for (const ct of contentTypes) byType[ct] = 0;
      if (Array.isArray(typeRows)) {
        for (const row of typeRows as Array<{ content_type: ContentType; count: number }>) {
          byType[row.content_type] = Number(row.count);
        }
      }

      // By source type
      const sourceRows = await query(
        `SELECT source_type, COUNT(*) as count FROM items WHERE deleted_at IS NULL GROUP BY source_type`,
        []
      );
      const bySource: Record<string, number> = {};
      if (Array.isArray(sourceRows)) {
        for (const row of sourceRows as Array<{ source_type: string; count: number }>) {
          bySource[row.source_type] = Number(row.count);
        }
      }

      // Favorites & archived
      const favRows = await query(`SELECT COUNT(*) as count FROM items WHERE is_favorite = 1 AND deleted_at IS NULL`, []);
      const favorites = Array.isArray(favRows) ? Number((favRows[0] as { count: number }).count) : 0;
      const archRows = await query(`SELECT COUNT(*) as count FROM items WHERE is_archived = 1 AND deleted_at IS NULL`, []);
      const archived = Array.isArray(archRows) ? Number((archRows[0] as { count: number }).count) : 0;

      // Total folders and tags
      const folderRows = await query(`SELECT COUNT(*) as total FROM folders`, []);
      const totalFolders = Array.isArray(folderRows) ? Number((folderRows[0] as { total: number }).total) : 0;
      const tagTotalRows = await query(`SELECT COUNT(*) as total FROM tags`, []);
      const totalTags = Array.isArray(tagTotalRows) ? Number((tagTotalRows[0] as { total: number }).total) : 0;

      // Weekly new
      const weekRows = await query(
        `SELECT COUNT(*) as count FROM items WHERE deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        []
      );
      const weeklyNew = Array.isArray(weekRows) ? Number((weekRows[0] as { count: number }).count) : 0;

      // Monthly trend (last 12 months)
      const trendRows = await query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
         FROM items WHERE deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY month ORDER BY month ASC`,
        []
      );
      const monthlyTrend: Array<{ month: string; count: number }> = [];
      if (Array.isArray(trendRows)) {
        for (const row of trendRows as Array<{ month: string; count: number }>) {
          monthlyTrend.push({ month: row.month, count: Number(row.count) });
        }
      }

      // Tag usage
      const tagRows = await query(
        `SELECT t.name, t.color, COUNT(it.item_id) as count
         FROM tags t
         LEFT JOIN item_tags it ON t.id = it.tag_id
         LEFT JOIN items i ON it.item_id = i.id AND i.deleted_at IS NULL
         GROUP BY t.id, t.name, t.color
         ORDER BY count DESC LIMIT 30`,
        []
      );
      const tagUsage: Array<{ name: string; color: string | null; count: number }> = [];
      if (Array.isArray(tagRows)) {
        for (const row of tagRows as Array<{ name: string; color: string | null; count: number }>) {
          tagUsage.push({ name: row.name, color: row.color, count: Number(row.count) });
        }
      }

      return { total, byType, bySource, favorites, archived, totalFolders, totalTags, weeklyNew, monthlyTrend, tagUsage };
    } catch (error) {
      throw new Error(`Failed to get dashboard stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all template items.
   */
  async getTemplates(): Promise<Item[]> {
    try {
      const rows = await query(
        `SELECT * FROM items WHERE is_template = 1 AND deleted_at IS NULL ORDER BY template_category, title`,
        []
      );
      return Array.isArray(rows) ? (rows as Item[]) : [];
    } catch (error) {
      throw new Error(`Failed to get templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /**
   * Replace all tag associations for an item with the given tag IDs.
   */
  private async setItemTags(itemId: number, tagIds: number[]): Promise<void> {
    // Remove existing associations
    await query(`DELETE FROM item_tags WHERE item_id = ?`, [itemId]);

    // Insert new associations
    if (tagIds.length > 0) {
      const values = tagIds.map(() => '(?, ?)').join(',');
      const params: unknown[] = [];
      for (const tagId of tagIds) {
        params.push(itemId, tagId);
      }
      await query(
        `INSERT INTO item_tags (item_id, tag_id) VALUES ${values}`,
        params
      );
    }
  }

  /**
   * Map a camelCase sort field name to the corresponding snake_case database column.
   */
  private mapSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      title: 'title',
      contentType: 'content_type',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      fileSize: 'file_size',
      isFavorite: 'is_favorite',
      isArchived: 'is_archived',
    };
    return fieldMap[field] ?? field;
  }
}

/** Singleton instance */
export const itemRepo = new ItemRepository();
