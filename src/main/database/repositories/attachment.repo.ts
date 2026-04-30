import { query } from '../connection';
import type { ResultSetHeader } from 'mysql2/promise';
import type { Attachment, CreateAttachmentDTO } from '../types';

/**
 * AttachmentRepository - Data access layer for file attachments.
 * Manages attachments associated with knowledge items.
 */
export class AttachmentRepository {
  // ----------------------------------------------------------------
  // Read operations
  // ----------------------------------------------------------------

  /**
   * Get all attachments for a specific item, ordered by sort_order.
   */
  async findByItem(itemId: number): Promise<Attachment[]> {
    try {
      const rows = await query(
        `SELECT * FROM attachments WHERE item_id = ? ORDER BY sort_order ASC, created_at ASC`,
        [itemId]
      );

      return Array.isArray(rows) ? (rows as Attachment[]) : [];
    } catch (error) {
      throw new Error(
        `Failed to find attachments for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ----------------------------------------------------------------
  // Write operations
  // ----------------------------------------------------------------

  /**
   * Create a new attachment.
   * Returns the ID of the newly created attachment.
   */
  async create(data: CreateAttachmentDTO): Promise<number> {
    try {
      const result = await query<ResultSetHeader>(
        `INSERT INTO attachments (item_id, file_name, file_path, file_size, mime_type, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.itemId,
          data.fileName,
          data.filePath,
          data.fileSize ?? null,
          data.mimeType ?? null,
          data.sortOrder ?? 0,
        ]
      );

      const insertId = result.insertId;

      if (typeof insertId !== 'number' || insertId === 0) {
        throw new Error('Failed to retrieve insert ID after attachment creation');
      }

      return insertId;
    } catch (error) {
      throw new Error(
        `Failed to create attachment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a single attachment by ID.
   */
  async delete(id: number): Promise<void> {
    try {
      await query(`DELETE FROM attachments WHERE id = ?`, [id]);
    } catch (error) {
      throw new Error(
        `Failed to delete attachment ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete all attachments for a specific item.
   */
  async deleteByItem(itemId: number): Promise<void> {
    try {
      await query(`DELETE FROM attachments WHERE item_id = ?`, [itemId]);
    } catch (error) {
      throw new Error(
        `Failed to delete attachments for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/** Singleton instance */
export const attachmentRepo = new AttachmentRepository();
