import { query } from '../connection';
import type { ItemLink } from '../types';

/**
 * LinkRepository - Data access layer for bidirectional item links.
 */
export class LinkRepository {

  /**
   * Get backlinks (items that link TO the given item).
   */
  async getBacklinks(itemId: number): Promise<ItemLink[]> {
    try {
      const rows = await query(
        `SELECT il.*, i.title, i.content_type, i.deleted_at
         FROM item_links il
         INNER JOIN items i ON il.source_item_id = i.id
         WHERE il.target_item_id = ?
         ORDER BY il.created_at DESC`,
        [itemId]
      );

      if (!Array.isArray(rows)) return [];

      return (rows as Array<{
        id: number;
        source_item_id: number;
        target_item_id: number;
        link_text: string | null;
        created_at: string;
        title: string;
        content_type: string;
        deleted_at: string | null;
      }>).map((row) => ({
        id: row.id,
        sourceItemId: row.source_item_id,
        targetItemId: row.target_item_id,
        linkText: row.link_text,
        createdAt: row.created_at,
        sourceItem: {
          id: row.source_item_id,
          title: row.title,
          contentType: row.content_type as ItemLink['sourceItem']['contentType'],
          deletedAt: row.deleted_at,
        },
      }));
    } catch (error) {
      throw new Error(
        `Failed to get backlinks for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get outlinks (items that the given item links TO).
   */
  async getOutlinks(itemId: number): Promise<ItemLink[]> {
    try {
      const rows = await query(
        `SELECT il.*, i.title, i.content_type, i.deleted_at
         FROM item_links il
         INNER JOIN items i ON il.target_item_id = i.id
         WHERE il.source_item_id = ?
         ORDER BY il.created_at DESC`,
        [itemId]
      );

      if (!Array.isArray(rows)) return [];

      return (rows as Array<{
        id: number;
        source_item_id: number;
        target_item_id: number;
        link_text: string | null;
        created_at: string;
        title: string;
        content_type: string;
        deleted_at: string | null;
      }>).map((row) => ({
        id: row.id,
        sourceItemId: row.source_item_id,
        targetItemId: row.target_item_id,
        linkText: row.link_text,
        createdAt: row.created_at,
        targetItem: {
          id: row.target_item_id,
          title: row.title,
          contentType: row.content_type as ItemLink['targetItem']['contentType'],
          deletedAt: row.deleted_at,
        },
      }));
    } catch (error) {
      throw new Error(
        `Failed to get outlinks for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a link between two items.
   */
  async createLink(sourceItemId: number, targetItemId: number, linkText?: string | null): Promise<number> {
    try {
      const result = await query<{ insertId: number }>(
        `INSERT IGNORE INTO item_links (source_item_id, target_item_id, link_text) VALUES (?, ?, ?)`,
        [sourceItemId, targetItemId, linkText ?? null]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(
        `Failed to create link: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a link by ID.
   */
  async deleteLink(linkId: number): Promise<void> {
    try {
      await query(`DELETE FROM item_links WHERE id = ?`, [linkId]);
    } catch (error) {
      throw new Error(
        `Failed to delete link ${linkId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch create links (ignore duplicates).
   */
  async createLinks(links: Array<{ sourceItemId: number; targetItemId: number; linkText?: string | null }>): Promise<void> {
    if (links.length === 0) return;

    try {
      const values = links.map(() => '(?, ?, ?)').join(',');
      const params: unknown[] = [];
      for (const link of links) {
        params.push(link.sourceItemId, link.targetItemId, link.linkText ?? null);
      }
      await query(
        `INSERT IGNORE INTO item_links (source_item_id, target_item_id, link_text) VALUES ${values}`,
        params
      );
    } catch (error) {
      throw new Error(
        `Failed to batch create links: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete links from source that are NOT in the given target IDs list.
   * Used to clean up removed links after content changes.
   */
  async deleteRemovedLinks(sourceItemId: number, keepTargetIds: number[]): Promise<void> {
    try {
      if (keepTargetIds.length === 0) {
        await query(`DELETE FROM item_links WHERE source_item_id = ?`, [sourceItemId]);
      } else {
        const placeholders = keepTargetIds.map(() => '?').join(',');
        await query(
          `DELETE FROM item_links WHERE source_item_id = ? AND target_item_id NOT IN (${placeholders})`,
          [sourceItemId, ...keepTargetIds]
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to clean up links: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete all links involving an item (both as source and target).
   */
  async deleteAllLinksForItem(itemId: number): Promise<void> {
    try {
      await query(
        `DELETE FROM item_links WHERE source_item_id = ? OR target_item_id = ?`,
        [itemId, itemId]
      );
    } catch (error) {
      throw new Error(
        `Failed to delete links for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all items + all links for graph rendering.
   */
  async getGraph(): Promise<{
    nodes: Array<{ id: number; title: string; contentType: string; folderId: number | null }>;
    edges: Array<{ source: number; target: number }>;
  }> {
    try {
      const itemRows = await query(
        `SELECT id, title, content_type, folder_id FROM items WHERE deleted_at IS NULL`,
        []
      );
      const linkRows = await query(
        `SELECT il.source_item_id, il.target_item_id
         FROM item_links il
         INNER JOIN items s ON il.source_item_id = s.id AND s.deleted_at IS NULL
         INNER JOIN items t ON il.target_item_id = t.id AND t.deleted_at IS NULL`,
        []
      );

      const nodes = Array.isArray(itemRows)
        ? (itemRows as Array<{ id: number; title: string; content_type: string; folder_id: number | null }>).map(
            (row) => ({
              id: row.id,
              title: row.title,
              contentType: row.content_type,
              folderId: row.folder_id,
            }),
          )
        : [];

      const edges = Array.isArray(linkRows)
        ? (linkRows as Array<{ source_item_id: number; target_item_id: number }>).map((row) => ({
            source: row.source_item_id,
            target: row.target_item_id,
          }))
        : [];

      return { nodes, edges };
    } catch (error) {
      throw new Error(
        `Failed to get graph: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Find items by title for link resolution.
   */
  async findItemByTitle(title: string): Promise<Array<{ id: number; title: string }>> {
    try {
      const rows = await query(
        `SELECT id, title FROM items WHERE title = ? AND deleted_at IS NULL LIMIT 5`,
        [title]
      );
      return Array.isArray(rows) ? (rows as Array<{ id: number; title: string }>) : [];
    } catch (error) {
      throw new Error(
        `Failed to find item by title: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/** Singleton instance */
export const linkRepo = new LinkRepository();
