import { query } from '../connection';
import type { ResultSetHeader } from 'mysql2/promise';
import type {
  FeedSource,
  FeedItem,
  FeedSourceType,
  CreateFeedSourceDTO,
  UpdateFeedSourceDTO,
  FeedQueryOptions,
  PaginatedResult,
} from '../types';

function mapFeedSourceRow(row: any): FeedSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type,
    description: row.description ?? null,
    iconUrl: row.icon_url ?? row.iconUrl ?? null,
    siteUrl: row.site_url ?? row.siteUrl ?? null,
    category: row.category ?? null,
    enabled: Boolean(row.enabled),
    fetchIntervalMinutes: row.fetch_interval_minutes ?? row.fetchIntervalMinutes ?? 60,
    lastFetchedAt: row.last_fetched_at ?? row.lastFetchedAt ?? null,
    failCount: row.fail_count ?? row.failCount ?? 0,
    lastError: row.last_error ?? row.lastError ?? null,
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}

function mapFeedItemRow(row: any): FeedItem {
  return {
    id: row.id,
    sourceId: row.source_id ?? row.sourceId,
    title: row.title,
    url: row.url,
    summary: row.summary ?? null,
    author: row.author ?? null,
    publishedAt: row.published_at ?? row.publishedAt ?? null,
    contentHash: row.content_hash ?? row.contentHash ?? null,
    importedItemId: row.imported_item_id ?? row.importedItemId ?? null,
    metadata: row.metadata ?? null,
    isRead: Boolean(row.is_read ?? row.isRead ?? 0),
    isStarred: Boolean(row.is_starred ?? row.isStarred ?? false),
    createdAt: row.created_at ?? row.createdAt ?? '',
  };
}

export class FeedRepository {
  async findAll(): Promise<FeedSource[]> {
    const rows = await query(
      `SELECT * FROM feed_sources ORDER BY created_at DESC`,
      []
    );
    if (!Array.isArray(rows)) return [];
    return rows.map(mapFeedSourceRow);
  }

  async findById(id: number): Promise<FeedSource | null> {
    const rows = await query(
      `SELECT * FROM feed_sources WHERE id = ?`,
      [id]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapFeedSourceRow(rows[0]);
  }

  async findByType(type: FeedSourceType): Promise<FeedSource[]> {
    const rows = await query(
      `SELECT * FROM feed_sources WHERE type = ? ORDER BY created_at DESC`,
      [type]
    );
    if (!Array.isArray(rows)) return [];
    return rows.map(mapFeedSourceRow);
  }

  async findEnabled(): Promise<FeedSource[]> {
    const rows = await query(
      `SELECT * FROM feed_sources WHERE enabled = 1 ORDER BY created_at DESC`,
      []
    );
    if (!Array.isArray(rows)) return [];
    return rows.map(mapFeedSourceRow);
  }

  async create(dto: CreateFeedSourceDTO): Promise<number> {
    const result = await query<ResultSetHeader>(
      `INSERT INTO feed_sources (name, url, type, description, icon_url, site_url, category, enabled, fetch_interval_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.name,
        dto.url,
        dto.type,
        dto.description ?? null,
        dto.iconUrl ?? null,
        dto.siteUrl ?? null,
        dto.category ?? null,
        dto.enabled !== false ? 1 : 0,
        dto.fetchIntervalMinutes ?? 60,
      ]
    );
    const insertId = result.insertId;
    if (typeof insertId !== 'number' || insertId === 0) {
      throw new Error('Failed to retrieve insert ID after feed source creation');
    }
    return insertId;
  }

  async update(id: number, dto: UpdateFeedSourceDTO): Promise<boolean> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (dto.name !== undefined) {
      setClauses.push('name = ?');
      params.push(dto.name);
    }
    if (dto.url !== undefined) {
      setClauses.push('url = ?');
      params.push(dto.url);
    }
    if (dto.description !== undefined) {
      setClauses.push('description = ?');
      params.push(dto.description);
    }
    if (dto.iconUrl !== undefined) {
      setClauses.push('icon_url = ?');
      params.push(dto.iconUrl);
    }
    if (dto.siteUrl !== undefined) {
      setClauses.push('site_url = ?');
      params.push(dto.siteUrl);
    }
    if (dto.category !== undefined) {
      setClauses.push('category = ?');
      params.push(dto.category);
    }
    if (dto.enabled !== undefined) {
      setClauses.push('enabled = ?');
      params.push(dto.enabled ? 1 : 0);
    }
    if (dto.fetchIntervalMinutes !== undefined) {
      setClauses.push('fetch_interval_minutes = ?');
      params.push(dto.fetchIntervalMinutes);
    }

    if (setClauses.length === 0) {
      return false;
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await query<ResultSetHeader>(
      `UPDATE feed_sources SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  async delete(id: number): Promise<void> {
    await query(`DELETE FROM feed_items WHERE source_id = ?`, [id]);
    await query(`DELETE FROM feed_sources WHERE id = ?`, [id]);
  }

  async batchDelete(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    await query(`DELETE FROM feed_items WHERE source_id IN (${placeholders})`, ids);
    await query(`DELETE FROM feed_sources WHERE id IN (${placeholders})`, ids);
  }

  async toggleEnabled(id: number): Promise<boolean> {
    const rows = await query(
      `SELECT enabled FROM feed_sources WHERE id = ?`,
      [id]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }
    const currentEnabled = Boolean((rows[0] as { enabled: number }).enabled);
    const newEnabled = currentEnabled ? 0 : 1;
    await query<ResultSetHeader>(
      `UPDATE feed_sources SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newEnabled, id]
    );
    return !currentEnabled;
  }

  async updateLastFetched(id: number): Promise<void> {
    await query<ResultSetHeader>(
      `UPDATE feed_sources SET last_fetched_at = CURRENT_TIMESTAMP, fail_count = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  }

  async incrementFailCount(id: number, errorMsg: string): Promise<number> {
    const result = await query<ResultSetHeader>(
      `UPDATE feed_sources SET fail_count = fail_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [errorMsg.slice(0, 500), id]
    );
    const rows = await query<any[]>(`SELECT fail_count FROM feed_sources WHERE id = ?`, [id]);
    return rows[0]?.fail_count ?? 0;
  }

  async findItems(options: FeedQueryOptions): Promise<PaginatedResult<FeedItem>> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.sourceId !== undefined && options.sourceId !== null) {
      conditions.push('fi.source_id = ?');
      params.push(options.sourceId);
    }

    if (options.sourceType !== undefined && options.sourceType !== null) {
      conditions.push('fs.type = ?');
      params.push(options.sourceType);
    }

    if (options.keyword) {
      conditions.push('MATCH(fi.title, fi.summary) AGAINST(? IN BOOLEAN MODE)');
      params.push(options.keyword);
    }

    if (options.importedOnly) {
      conditions.push('fi.imported_item_id IS NOT NULL');
    }

    if (options.unimportedOnly) {
      conditions.push('fi.imported_item_id IS NULL');
    }

    if (options.starredOnly) {
      conditions.push('fi.is_starred = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM feed_items fi INNER JOIN feed_sources fs ON fi.source_id = fs.id ${whereClause}`,
      params
    );
    const total = Array.isArray(countRows) && countRows.length > 0
      ? Number((countRows[0] as { total: number }).total)
      : 0;

    const safeLimit = Number(pageSize) || 20;
    const safeOffset = Number(offset) || 0;
    const dataRows = await query(
      `SELECT fi.*, fs.id as source_id_col, fs.name as source_name, fs.url as source_url, fs.type as source_type, fs.icon_url as source_icon_url, fs.site_url as source_site_url
       FROM feed_items fi
       INNER JOIN feed_sources fs ON fi.source_id = fs.id
       ${whereClause}
       ORDER BY COALESCE(fi.published_at, fi.created_at) DESC, fi.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    const items: FeedItem[] = Array.isArray(dataRows)
      ? (dataRows as any[]).map((row: any) => {
          const item = mapFeedItemRow(row);
          if (row.source_id_col) {
            item.source = {
              id: row.source_id_col,
              name: row.source_name,
              url: row.source_url,
              type: row.source_type,
              description: null,
              iconUrl: row.source_icon_url ?? null,
              siteUrl: row.source_site_url ?? null,
              category: null,
              enabled: true,
              fetchIntervalMinutes: 60,
              lastFetchedAt: null,
              failCount: 0,
              lastError: null,
              createdAt: '',
              updatedAt: '',
            };
          }
          return item;
        })
      : [];

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findItemByUrl(url: string): Promise<FeedItem | null> {
    const rows = await query(
      `SELECT * FROM feed_items WHERE url = ? LIMIT 1`,
      [url]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapFeedItemRow(rows[0]);
  }

  async findItemById(id: number): Promise<FeedItem | null> {
    const rows = await query(
      `SELECT * FROM feed_items WHERE id = ?`,
      [id]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapFeedItemRow(rows[0]);
  }

  async createItem(data: {
    sourceId: number;
    title: string;
    url: string;
    summary?: string | null;
    author?: string | null;
    publishedAt?: string | null;
    contentHash?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<number> {
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
    const result = await query<ResultSetHeader>(
      `INSERT INTO feed_items (source_id, title, url, summary, author, published_at, content_hash, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.sourceId,
        data.title,
        data.url,
        data.summary ?? null,
        data.author ?? null,
        data.publishedAt ?? null,
        data.contentHash ?? null,
        metadataJson,
      ].map(v => v === undefined ? null : v)
    );
    const insertId = result.insertId;
    if (typeof insertId !== 'number' || insertId === 0) {
      throw new Error('Failed to retrieve insert ID after feed item creation');
    }
    return insertId;
  }

  async markAsImported(feedItemId: number, importedItemId: number): Promise<boolean> {
    const result = await query<ResultSetHeader>(
      `UPDATE feed_items SET imported_item_id = ? WHERE id = ?`,
      [importedItemId, feedItemId]
    );
    return result.affectedRows > 0;
  }

  async markAsRead(feedItemId: number): Promise<boolean> {
    const result = await query<ResultSetHeader>(
      `UPDATE feed_items SET is_read = 1 WHERE id = ?`,
      [feedItemId]
    );
    return result.affectedRows > 0;
  }

  async toggleStar(id: number): Promise<void> {
    await query<ResultSetHeader>(
      'UPDATE feed_items SET is_starred = NOT is_starred WHERE id = ?',
      [id]
    );
  }

  async deleteBySourceId(sourceId: number): Promise<void> {
    await query(
      `DELETE FROM feed_items WHERE source_id = ? AND imported_item_id IS NULL`,
      [sourceId]
    );
  }

  async deleteOldItems(daysOld: number = 30): Promise<void> {
    await query(
      `DELETE FROM feed_items WHERE imported_item_id IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysOld]
    );
  }

  async updateItemMetadata(id: number, metadata: Record<string, unknown>): Promise<void> {
    await query<ResultSetHeader>(
      `UPDATE feed_items SET metadata = ? WHERE id = ?`,
      [JSON.stringify(metadata), id]
    )
  }

  async clearImportedItemId(importedItemId: number): Promise<void> {
    await query<ResultSetHeader>(
      `UPDATE feed_items SET imported_item_id = NULL WHERE imported_item_id = ?`,
      [importedItemId]
    )
  }

  async findUrlsBySourceId(sourceId: number): Promise<string[]> {
    const rows = await query(
      `SELECT url FROM feed_items WHERE source_id = ?`,
      [sourceId]
    );
    if (!Array.isArray(rows)) {
      return [];
    }
    return (rows as Array<{ url: string }>).map((r) => r.url);
  }
}

export const feedRepo = new FeedRepository();
