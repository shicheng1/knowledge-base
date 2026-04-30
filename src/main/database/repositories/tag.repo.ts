import { query } from '../connection';
import type { ResultSetHeader } from 'mysql2/promise';
import type { Tag, UpdateTagDTO } from '../types';

/**
 * TagRepository - Data access layer for tags.
 * Manages tags and their associations with items.
 */
export class TagRepository {
  // ----------------------------------------------------------------
  // Read operations
  // ----------------------------------------------------------------

  /**
   * Get all tags, ordered by name.
   */
  async findAll(): Promise<Tag[]> {
    try {
      const rows = await query(
        `SELECT * FROM tags ORDER BY name ASC`,
        []
      );

      return Array.isArray(rows) ? (rows as Tag[]) : [];
    } catch (error) {
      throw new Error(
        `Failed to find all tags: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a single tag by its ID.
   */
  async findById(id: number): Promise<Tag | null> {
    try {
      const rows = await query(
        `SELECT * FROM tags WHERE id = ?`,
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      return rows[0] as Tag;
    } catch (error) {
      throw new Error(
        `Failed to find tag by id ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find a tag by its name (case-insensitive).
   */
  async findByName(name: string): Promise<Tag | null> {
    try {
      const rows = await query(
        `SELECT * FROM tags WHERE LOWER(name) = LOWER(?)`,
        [name]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      return rows[0] as Tag;
    } catch (error) {
      throw new Error(
        `Failed to find tag by name "${name}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all tags associated with a specific item.
   */
  async getByItem(itemId: number): Promise<Tag[]> {
    try {
      const rows = await query(
        `SELECT t.* FROM tags t
         INNER JOIN item_tags it ON t.id = it.tag_id
         WHERE it.item_id = ?
         ORDER BY t.name ASC`,
        [itemId]
      );

      return Array.isArray(rows) ? (rows as Tag[]) : [];
    } catch (error) {
      throw new Error(
        `Failed to get tags for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ----------------------------------------------------------------
  // Write operations
  // ----------------------------------------------------------------

  /**
   * Create a new tag.
   * Returns the ID of the newly created tag.
   */
  async create(name: string, color?: string | null): Promise<number> {
    try {
      const result = await query<ResultSetHeader>(
        `INSERT INTO tags (name, color) VALUES (?, ?)`,
        [name, color ?? null]
      );

      const insertId = result.insertId;

      if (typeof insertId !== 'number' || insertId === 0) {
        throw new Error('Failed to retrieve insert ID after tag creation');
      }

      return insertId;
    } catch (error) {
      throw new Error(
        `Failed to create tag "${name}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update an existing tag.
   */
  async update(id: number, data: Partial<UpdateTagDTO>): Promise<void> {
    try {
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (data.name !== undefined) {
        setClauses.push('name = ?');
        params.push(data.name);
      }
      if (data.color !== undefined) {
        setClauses.push('color = ?');
        params.push(data.color);
      }

      if (setClauses.length === 0) {
        return; // Nothing to update
      }

      params.push(id);

      await query(
        `UPDATE tags SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    } catch (error) {
      throw new Error(
        `Failed to update tag ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a tag by ID. Also removes all item-tag associations.
   */
  async delete(id: number): Promise<void> {
    try {
      // Remove associations first
      await query(`DELETE FROM item_tags WHERE tag_id = ?`, [id]);

      // Delete the tag
      await query(`DELETE FROM tags WHERE id = ?`, [id]);
    } catch (error) {
      throw new Error(
        `Failed to delete tag ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Set (replace) all tags for a specific item.
   * Removes all existing associations and creates new ones.
   */
  async setForItem(itemId: number, tagIds: number[]): Promise<void> {
    try {
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
    } catch (error) {
      throw new Error(
        `Failed to set tags for item ${itemId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find a tag by name or create it if it doesn't exist.
   * Returns the tag object.
   */
  async findOrCreate(name: string, color?: string | null): Promise<Tag> {
    try {
      const rows = await query(
        `SELECT * FROM tags WHERE name = ? LIMIT 1`,
        [name]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] as Tag;
      }
      const id = await this.create(name, color);
      return { id, name, color: color ?? null, createdAt: new Date().toISOString() };
    } catch (error) {
      throw new Error(
        `Failed to find or create tag "${name}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/** Singleton instance */
export const tagRepo = new TagRepository();
