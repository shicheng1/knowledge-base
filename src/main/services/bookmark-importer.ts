import * as fs from 'fs/promises';
import { itemRepo } from '../database/repositories/item.repo';
import { folderRepo } from '../database/repositories/folder.repo';
import { logger } from '../utils/logger';

interface BookmarkEntry {
  title: string;
  url: string;
  addDate?: string;
}

interface BookmarkFolder {
  name: string;
  bookmarks: BookmarkEntry[];
  subfolders: BookmarkFolder[];
}

interface ImportResult {
  total: number;
  imported: number;
  errors: string[];
}

/**
 * Import browser bookmarks from a Netscape Bookmark File Format HTML file.
 * Supports Chrome, Firefox, and Edge exports.
 */
export async function importBookmarks(htmlPath: string, parentFolderId?: number | null): Promise<ImportResult> {
  const result: ImportResult = { total: 0, imported: 0, errors: [] };

  let html: string;
  try {
    html = await fs.readFile(htmlPath, 'utf-8');
  } catch (err) {
    return { total: 0, imported: 0, errors: [`Cannot read file: ${(err as Error).message}`] };
  }

  // Parse bookmark structure
  const root = parseBookmarkHtml(html);

  async function processFolder(bf: BookmarkFolder, parentId: number | null): Promise<void> {
    // Create folder for this group
    let folderId: number | null = parentId;
    if (bf.name && bf.name !== 'root' && bf.name !== 'Bookmarks Bar') {
      try {
        const folder = await folderRepo.createOrGet({
          name: bf.name,
          parentId,
        });
        folderId = folder.id;
      } catch (err) {
        logger.warn(`Cannot create folder ${bf.name}: ${(err as Error).message}`);
      }
    }

    // Import bookmarks in this folder
    for (const bm of bf.bookmarks) {
      result.total++;
      try {
        await itemRepo.create({
          title: bm.title || bm.url,
          content: null,
          summary: null,
          contentType: 'bookmark',
          sourceUrl: bm.url,
          sourceType: 'import',
          sourceName: '浏览器书签',
          folderId,
        });
        result.imported++;
      } catch (err) {
        result.errors.push(`${bm.title}: ${(err as Error).message}`);
      }
    }

    // Process subfolders
    for (const sub of bf.subfolders) {
      await processFolder(sub, folderId);
    }
  }

  await processFolder(root, parentFolderId ?? null);
  return result;
}

/**
 * Simple parser for Netscape Bookmark File Format.
 */
function parseBookmarkHtml(html: string): BookmarkFolder {
  const root: BookmarkFolder = { name: 'root', bookmarks: [], subfolders: [] };
  const stack: BookmarkFolder[] = [root];

  // Match all DT elements
  const dtRegex = /<DT>(.*?)<\/DT>/gs;
  let m: RegExpExecArray | null;

  while ((m = dtRegex.exec(html)) !== null) {
    const content = m[1].trim();

    // Folder/heading
    const h3Match = content.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (h3Match) {
      const folderName = h3Match[1].replace(/<[^>]+>/g, '').trim();
      if (content.includes('</DL>')) {
        // Closing a folder
        if (stack.length > 1) stack.pop();
      } else {
        // New folder
        const newFolder: BookmarkFolder = { name: folderName, bookmarks: [], subfolders: [] };
        stack[stack.length - 1].subfolders.push(newFolder);
        if (content.includes('<DL>')) {
          stack.push(newFolder);
        }
      }
      continue;
    }

    // Closing DL
    if (content === '</DL>') {
      if (stack.length > 1) stack.pop();
      continue;
    }

    // Bookmark link
    const aMatch = content.match(/<A[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/i);
    if (aMatch) {
      const url = aMatch[1];
      const title = aMatch[2].replace(/<[^>]+>/g, '').trim();
      const addDateMatch = content.match(/ADD_DATE="(\d+)"/i);
      stack[stack.length - 1].bookmarks.push({
        title: title || url,
        url,
        addDate: addDateMatch ? new Date(Number(addDateMatch[1]) * 1000).toISOString() : undefined,
      });
    }
  }

  return root;
}
