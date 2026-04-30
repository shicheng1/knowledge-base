import { ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getStorageRootPath } from '../utils/config';
import { itemRepo } from '../database/repositories/item.repo';
import { folderRepo } from '../database/repositories/folder.repo';
import { importFromFile } from '../services/import-service';
import { extractFromHtml } from '../services/content-extractor';
import { createEmptyDocx, createEmptyXlsx, createEmptyMd, readFileAsBuffer, readExcelData, writeFileContent } from '../services/office-template';
import { recognizeImage, isOcrEnabled } from '../services/ocr-service';
import type { IpcResult } from '../database/types';
import type { ContentType } from '../database/types';

const BINARY_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
  '.mp3', '.wav', '.flac', '.ogg', '.aac', '.wma',
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv',
  '.exe', '.msi', '.dmg', '.iso',
]);

const FILE_CONTENT_TYPE_EXTENSIONS: Record<string, ContentType> = {
  '.pdf': 'file', '.doc': 'file', '.docx': 'file',
  '.xls': 'file', '.xlsx': 'file', '.ppt': 'file', '.pptx': 'file',
  '.txt': 'note', '.md': 'note', '.csv': 'file',
  '.html': 'article', '.htm': 'article',
  '.json': 'code', '.xml': 'code',
  '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code',
  '.c': 'code', '.cpp': 'code', '.h': 'code', '.go': 'code',
  '.rs': 'code', '.sh': 'code', '.bat': 'code', '.ps1': 'code',
  '.sql': 'code', '.yaml': 'code', '.yml': 'code', '.toml': 'code',
  '.css': 'code', '.scss': 'code', '.less': 'code',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image',
  '.gif': 'image', '.bmp': 'image', '.svg': 'image', '.webp': 'image',
};

function getContentTypeForFile(ext: string): ContentType {
  return FILE_CONTENT_TYPE_EXTENSIONS[ext] ?? 'other';
}

function isBinaryFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

const AUTO_CLASSIFY_RULES: Record<string, string> = {
  note: '笔记',
  article: '文章',
  code: '代码',
  image: '图片',
  file: '文档',
};

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  };
  return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
}

export function registerFileHandlers(): void {
  async function findOrCreateAutoClassifyFolder(contentType: ContentType): Promise<number | null> {
    const folderName = AUTO_CLASSIFY_RULES[contentType];
    if (!folderName) return null;

    try {
      const roots = await folderRepo.findRoots();
      const existing = roots.find((f: any) => f.name === folderName);
      if (existing) return existing.id;

      const newId = await folderRepo.create({ name: folderName, parentId: null });
      return newId;
    } catch (err) {
      return null;
    }
  }

  ipcMain.handle('file:selectDirectory', async (): Promise<IpcResult<string | null>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }
      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle(
    'file:importFile',
    async (
      _event,
      sourcePath: string,
      fileName?: string
    ): Promise<IpcResult<{ filePath: string; fileName: string; fileSize: number }>> => {
      try {
        const stat = await fs.stat(sourcePath);
        if (!stat.isFile()) {
          return { success: false, error: `Source path is not a file: ${sourcePath}` };
        }
        const storageDir = getStorageRootPath();
        if (!storageDir) {
          return { success: false, error: 'Storage path is not configured.' };
        }
        await fs.mkdir(storageDir, { recursive: true });
        const targetFileName = fileName ?? path.basename(sourcePath);
        const targetPath = path.join(storageDir, targetFileName);
        let finalTargetPath = targetPath;
        try {
          await fs.access(finalTargetPath);
          const ext = path.extname(targetFileName);
          const baseName = path.basename(targetFileName, ext);
          finalTargetPath = path.join(storageDir, `${baseName}_${Date.now()}${ext}`);
        } catch {}
        await fs.copyFile(sourcePath, finalTargetPath);
        const copiedStat = await fs.stat(finalTargetPath);
        return {
          success: true,
          data: {
            filePath: finalTargetPath,
            fileName: path.basename(finalTargetPath),
            fileSize: copiedStat.size,
          },
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  ipcMain.handle('file:openFile', async (_event, filePath: string): Promise<IpcResult<void>> => {
    try {
      await fs.access(filePath);
      const result = await shell.openPath(filePath);
      if (result) {
        return { success: false, error: `Failed to open file: ${result}` };
      }
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(
    'file:importByDrag',
    async (
      _event,
      files: Array<{ name: string; content?: string; arrayBuffer?: number[]; type: string; isBinary: boolean }>,
      folderId?: number | null
    ): Promise<IpcResult<Array<{ fileName: string; success: boolean; itemId?: number; error?: string }>>> => {
      try {
        const results: Array<{ fileName: string; success: boolean; itemId?: number; error?: string }> = [];

        for (const file of files) {
          try {
            const ext = path.extname(file.name).toLowerCase();
            const contentType = getContentTypeForFile(ext);

            let targetFolderId = folderId ?? null;
            if (targetFolderId === null) {
              targetFolderId = await findOrCreateAutoClassifyFolder(contentType);
            }

            if (file.isBinary && file.arrayBuffer) {
              const storageDir = getStorageRootPath();
              await fs.mkdir(storageDir, { recursive: true });
              let targetPath = path.join(storageDir, file.name);
              try {
                await fs.access(targetPath);
                const baseName = path.basename(file.name, ext);
                targetPath = path.join(storageDir, `${baseName}_${Date.now()}${ext}`);
              } catch {}
              const buffer = Buffer.from(file.arrayBuffer);
              await fs.writeFile(targetPath, buffer);

              const dto = {
                title: file.name.replace(/\.[^.]+$/, ''),
                content: '',
                contentHtml: '',
                summary: `文件附件: ${file.name} (${(buffer.length / 1024).toFixed(1)} KB)`,
                contentType,
                sourceUrl: null,
                sourceType: 'file' as const,
                sourceName: file.name,
                filePath: targetPath,
                fileSize: buffer.length,
                mimeType: getMimeType(ext),
                folderId: targetFolderId,
              };

              const itemId = await itemRepo.create(dto);
              results.push({ fileName: file.name, success: true, itemId });

              // 图片类型 → 后台异步 OCR 识别（不阻塞导入流程）
              if (contentType === 'image' && isOcrEnabled()) {
                recognizeImage(targetPath).then((ocrText) => {
                  if (ocrText) {
                    itemRepo.update(itemId, { metadata: { ocr_text: ocrText } }).catch(() => {});
                  }
                }).catch(() => {});
              }
            } else {
              let title = file.name.replace(/\.[^.]+$/, '');
              let content = file.content ?? '';
              let contentHtml = '';
              let summary = '';

              if (ext === '.html' || ext === '.htm') {
                try {
                  const extracted = await extractFromHtml(content, `file://${file.name}`);
                  title = extracted.title || title;
                  content = extracted.content;
                  contentHtml = extracted.contentHtml;
                  summary = extracted.summary;
                } catch {
                  summary = content.trim().slice(0, 200);
                  contentHtml = content;
                }
              } else if (ext === '.md') {
                summary = content.trim().slice(0, 200).replace(/\s+/g, ' ') +
                  (content.length > 200 ? '...' : '');
              } else {
                summary = content.trim().slice(0, 200).replace(/\s+/g, ' ') +
                  (content.length > 200 ? '...' : '');
              }

              const dto = {
                title,
                content,
                contentHtml,
                summary,
                contentType,
                sourceUrl: null,
                sourceType: 'file' as const,
                sourceName: file.name,
                fileSize: content.length,
                mimeType: getMimeType(ext),
                folderId: targetFolderId,
              };

              const itemId = await itemRepo.create(dto);
              results.push({ fileName: file.name, success: true, itemId });
            }
          } catch (err) {
            results.push({
              fileName: file.name,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  ipcMain.handle(
    'file:importFilesByContent',
    async (
      _event,
      files: Array<{ name: string; content: string; type: string; isBinary: boolean }>,
      folderId?: number | null
    ): Promise<IpcResult<Array<{ fileName: string; success: boolean; itemId?: number; error?: string }>>> => {
      try {
        const results: Array<{ fileName: string; success: boolean; itemId?: number; error?: string }> = [];

        for (const file of files) {
          try {
            const ext = path.extname(file.name).toLowerCase();
            const contentType = getContentTypeForFile(ext);

            let targetFolderId = folderId ?? null;
            if (targetFolderId === null) {
              targetFolderId = await findOrCreateAutoClassifyFolder(contentType);
            }

            let title = file.name.replace(/\.[^.]+$/, '');
            let content = file.content;
            let contentHtml = '';
            let summary = '';

            if (file.isBinary) {
              summary = `文件附件: ${file.name}`;
            } else if (ext === '.html' || ext === '.htm') {
              try {
                const extracted = await extractFromHtml(file.content, `file://${file.name}`);
                title = extracted.title || title;
                content = extracted.content;
                contentHtml = extracted.contentHtml;
                summary = extracted.summary;
              } catch {
                summary = file.content.trim().slice(0, 200);
                contentHtml = file.content;
              }
            } else if (ext === '.md' || ext === '.txt') {
              summary = file.content.trim().slice(0, 200).replace(/\s+/g, ' ') +
                (file.content.length > 200 ? '...' : '');
            } else {
              summary = `文档文件: ${file.name}`;
            }

            const dto = {
              title,
              content,
              contentHtml,
              summary,
              contentType,
              sourceUrl: null,
              sourceType: 'file' as const,
              sourceName: file.name,
              folderId: targetFolderId,
            };

            const itemId = await itemRepo.create(dto);
            results.push({ fileName: file.name, success: true, itemId });
          } catch (err) {
            results.push({
              fileName: file.name,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  ipcMain.handle('file:readFileAsBuffer', async (_event, filePath: string): Promise<IpcResult<number[]>> => {
    try {
      const buffer = readFileAsBuffer(filePath);
      return { success: true, data: Array.from(buffer) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:createEmptyDocx', async (_event, fileName?: string): Promise<IpcResult<string>> => {
    try {
      const filePath = await createEmptyDocx(fileName);
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:createEmptyXlsx', async (_event, fileName?: string): Promise<IpcResult<string>> => {
    try {
      const filePath = await createEmptyXlsx(fileName);
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:createEmptyMd', async (_event, fileName?: string): Promise<IpcResult<string>> => {
    try {
      const filePath = await createEmptyMd(fileName);
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:readExcelData', async (_event, filePath: string): Promise<IpcResult<{ sheets: Array<{ name: string; headers: string[]; rows: string[][] }> }>> => {
    try {
      const data = await readExcelData(filePath);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:writeFileContent', async (_event, filePath: string, content: string): Promise<IpcResult<void>> => {
    try {
      writeFileContent(filePath, content);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
