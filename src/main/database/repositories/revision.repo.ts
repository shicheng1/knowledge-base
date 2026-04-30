import { createHash } from 'crypto';
import { query } from '../connection';
import type { ResultSetHeader } from 'mysql2/promise';

export interface ItemRevision {
  id: number;
  itemId: number;
  title: string | null;
  content: string | null;
  contentHash: string | null;
  revisionNumber: number;
  createdAt: string;
}

export class RevisionRepository {
  /**
   * Compute SHA256 hash of content.
   */
  private hashContent(content: string | null): string {
    return createHash('sha256').update(content ?? '').digest('hex');
  }

  /**
   * Create a revision snapshot if content has changed since the last revision.
   * Returns the new revision or null if unchanged.
   */
  async maybeCreateRevision(itemId: number, title: string, content: string | null): Promise<ItemRevision | null> {
    try {
      const newHash = this.hashContent(content);

      // Get the latest revision
      const lastRows = await query(
        `SELECT content_hash, revision_number FROM item_revisions
         WHERE item_id = ? ORDER BY revision_number DESC LIMIT 1`,
        [itemId]
      );

      const lastHash = Array.isArray(lastRows) && lastRows.length > 0
        ? (lastRows[0] as { content_hash: string | null; revision_number: number }).content_hash
        : null;

      // Skip if unchanged
      if (lastHash === newHash) {
        return null;
      }

      const nextNumber = Array.isArray(lastRows) && lastRows.length > 0
        ? (lastRows[0] as { revision_number: number }).revision_number + 1
        : 1;

      const result = await query<ResultSetHeader>(
        `INSERT INTO item_revisions (item_id, title, content, content_hash, revision_number)
         VALUES (?, ?, ?, ?, ?)`,
        [itemId, title, content, newHash, nextNumber]
      );

      return {
        id: result.insertId,
        itemId,
        title,
        content,
        contentHash: newHash,
        revisionNumber: nextNumber,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to create revision for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all revisions for an item, newest first.
   */
  async getRevisions(itemId: number): Promise<ItemRevision[]> {
    try {
      const rows = await query(
        `SELECT id, item_id, title, content, content_hash, revision_number, created_at
         FROM item_revisions
         WHERE item_id = ?
         ORDER BY revision_number DESC
         LIMIT 50`,
        [itemId]
      );

      if (!Array.isArray(rows)) return [];

      return (rows as Array<{
        id: number;
        item_id: number;
        title: string | null;
        content: string | null;
        content_hash: string | null;
        revision_number: number;
        created_at: string;
      }>).map((r) => ({
        id: r.id,
        itemId: r.item_id,
        title: r.title,
        content: r.content,
        contentHash: r.content_hash,
        revisionNumber: r.revision_number,
        createdAt: r.created_at,
      }));
    } catch (error) {
      throw new Error(
        `Failed to get revisions for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a single revision by ID.
   */
  async getRevision(id: number): Promise<ItemRevision | null> {
    try {
      const rows = await query(
        `SELECT id, item_id, title, content, content_hash, revision_number, created_at
         FROM item_revisions WHERE id = ?`,
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) return null;

      const r = rows[0] as {
        id: number;
        item_id: number;
        title: string | null;
        content: string | null;
        content_hash: string | null;
        revision_number: number;
        created_at: string;
      };

      return {
        id: r.id,
        itemId: r.item_id,
        title: r.title,
        content: r.content,
        contentHash: r.content_hash,
        revisionNumber: r.revision_number,
        createdAt: r.created_at,
      };
    } catch (error) {
      throw new Error(
        `Failed to get revision ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete revisions older than the 50 most recent for an item.
   */
  async cleanupOldRevisions(itemId: number): Promise<number> {
    try {
      const result = await query<ResultSetHeader>(
        `DELETE FROM item_revisions WHERE item_id = ? AND id NOT IN (
          SELECT id FROM (
            SELECT id FROM item_revisions WHERE item_id = ? ORDER BY revision_number DESC LIMIT 50
          ) AS recent
        )`,
        [itemId, itemId]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(
        `Failed to clean up revisions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const revisionRepo = new RevisionRepository();
