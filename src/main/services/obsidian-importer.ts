import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { itemRepo } from '../database/repositories/item.repo';
import { folderRepo } from '../database/repositories/folder.repo';
import { tagRepo } from '../database/repositories/tag.repo';

interface ImportResult {
  total: number;
  imported: number;
  errors: string[];
}

/**
 * Import an Obsidian vault (directory of .md files).
 * Preserves directory structure as folder hierarchy.
 * Parses YAML frontmatter for tags.
 */
export async function importObsidianVault(dirPath: string, parentFolderId?: number | null): Promise<ImportResult> {
  const result: ImportResult = { total: 0, imported: 0, errors: [] };

  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      return { total: 0, imported: 0, errors: ['Path is not a directory'] };
    }
  } catch {
    return { total: 0, imported: 0, errors: ['Directory not found'] };
  }

  // Cache: folder name -> folder ID
  const folderCache = new Map<string, number>();

  async function processDirectory(dir: string, currentParentId: number | null): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      result.errors.push(`Cannot read directory ${dir}: ${(err as Error).message}`);
      return;
    }

    // Process files first, then subdirectories
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name.endsWith('.md')) {
        result.total++;
        try {
          const rawContent = await fs.readFile(fullPath, 'utf-8');
          const { title, content, tags } = parseFrontmatter(entry.name, rawContent);

          // Resolve tags
          let tagIds: number[] = [];
          for (const tagName of tags) {
            try {
              const tag = await tagRepo.findOrCreate(tagName);
              tagIds.push(tag.id);
            } catch {
              // Skip tag errors
            }
          }

          await itemRepo.create({
            title,
            content,
            contentType: 'note',
            sourceType: 'import',
            sourceName: 'Obsidian',
            filePath: null,
            folderId: currentParentId,
            tagIds,
          });
          result.imported++;
          logger.info(`Imported Obsidian note: ${title}`);
        } catch (err) {
          result.errors.push(`${entry.name}: ${(err as Error).message}`);
        }
      }

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Create corresponding folder
        let folderId: number | null = null;
        const cacheKey = `${currentParentId}:${entry.name}`;
        if (folderCache.has(cacheKey)) {
          folderId = folderCache.get(cacheKey)!;
        } else {
          try {
            const folder = await folderRepo.createOrGet({
              name: entry.name,
              parentId: currentParentId,
            });
            folderId = folder.id;
            folderCache.set(cacheKey, folderId);
          } catch (err) {
            logger.warn(`Cannot create folder for ${entry.name}: ${(err as Error).message}`);
          }
        }

        await processDirectory(fullPath, folderId);
      }
    }
  }

  await processDirectory(dirPath, parentFolderId ?? null);
  return result;
}

/**
 * Parse YAML frontmatter from a Markdown file.
 * Format:
 * ---
 * tags: [tag1, tag2]
 * title: Custom Title
 * ---
 * Content here
 */
function parseFrontmatter(
  fileName: string,
  rawContent: string
): { title: string; content: string; tags: string[] } {
  const frontmatterMatch = rawContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);

  let title = fileName.replace(/\.md$/, '');
  let content = rawContent;
  const tags: string[] = [];

  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    content = rawContent.slice(frontmatterMatch[0].length);

    // Parse title
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Parse tags
    const tagsMatch = fm.match(/^tags:\s*\[(.+)\]$/m);
    if (tagsMatch) {
      tags.push(...tagsMatch[1].split(',').map((t) => t.trim().replace(/^["']|["']$/g, '')));
    } else {
      // Multi-line tags
      const tagsLines = fm.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
      if (tagsLines) {
        const lineMatches = tagsLines[1].matchAll(/-\s*(.+)/g);
        for (const m of lineMatches) {
          tags.push(m[1].trim().replace(/^["']|["']$/g, ''));
        }
      }
    }
  }

  return { title, content, tags };
}
