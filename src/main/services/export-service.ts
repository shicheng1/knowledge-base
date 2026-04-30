import { dialog } from 'electron';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import JSZip from 'jszip';
import { itemRepo } from '../database/repositories/item.repo';
import { logger } from '../utils/logger';

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);
}

function itemToMarkdown(item: any): string {
  const lines: string[] = [];
  lines.push(`# ${item.title}`);
  lines.push('');

  if (item.summary) {
    lines.push(`> ${item.summary}`);
    lines.push('');
  }

  if (item.source_url) {
    lines.push(`**来源**: ${item.source_url}`);
    lines.push('');
  }

  if (item.tags && item.tags.length > 0) {
    lines.push(`**标签**: ${item.tags.map((t: any) => t.name).join(', ')}`);
    lines.push('');
  }

  lines.push(`**创建时间**: ${item.created_at}`);
  lines.push(`**更新时间**: ${item.updated_at}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (item.content) {
    lines.push(item.content);
  } else if (item.content_html) {
    lines.push(item.content_html);
  }

  return lines.join('\n');
}

function itemToJSON(item: any): string {
  const exportData = {
    id: item.id,
    title: item.title,
    content: item.content,
    contentHtml: item.content_html,
    summary: item.summary,
    contentType: item.content_type,
    sourceUrl: item.source_url,
    sourceType: item.source_type,
    tags: item.tags?.map((t: any) => ({ id: t.id, name: t.name, color: t.color })),
    metadata: item.metadata,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
  return JSON.stringify(exportData, null, 2);
}

export async function exportItemAsMarkdown(itemId: number): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const item = await itemRepo.findById(itemId);
    if (!item) {
      return { success: false, error: '条目不存在' };
    }

    const result = await dialog.showSaveDialog({
      title: '导出为 Markdown',
      defaultPath: sanitizeFileName(item.title) + '.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: '用户取消' };
    }

    const content = itemToMarkdown(item);
    writeFileSync(result.filePath, content, 'utf-8');

    logger.info(`导出 Markdown 成功: ${result.filePath}`);
    return { success: true, path: result.filePath };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('导出 Markdown 失败:', error);
    return { success: false, error: msg };
  }
}

export async function exportItemAsJSON(itemId: number): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const item = await itemRepo.findById(itemId);
    if (!item) {
      return { success: false, error: '条目不存在' };
    }

    const result = await dialog.showSaveDialog({
      title: '导出为 JSON',
      defaultPath: sanitizeFileName(item.title) + '.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: '用户取消' };
    }

    const content = itemToJSON(item);
    writeFileSync(result.filePath, content, 'utf-8');

    logger.info(`导出 JSON 成功: ${result.filePath}`);
    return { success: true, path: result.filePath };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('导出 JSON 失败:', error);
    return { success: false, error: msg };
  }
}

export async function batchExportAsZip(itemIds: number[]): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const zip = new JSZip();

    for (const id of itemIds) {
      const item = await itemRepo.findById(id);
      if (!item) continue;

      const folderName = sanitizeFileName(item.title);
      zip.file(`${folderName}/${folderName}.md`, itemToMarkdown(item));
      zip.file(`${folderName}/${folderName}.json`, itemToJSON(item));
    }

    const result = await dialog.showSaveDialog({
      title: '批量导出为 ZIP',
      defaultPath: `knowledge-export-${Date.now()}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: '用户取消' };
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    writeFileSync(result.filePath, content);

    logger.info(`批量导出 ZIP 成功: ${result.filePath}`);
    return { success: true, path: result.filePath };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('批量导出 ZIP 失败:', error);
    return { success: false, error: msg };
  }
}
