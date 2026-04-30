import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getStorageRootPath } from '../utils/config';
import { logger } from '../utils/logger';

const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
};

export function saveImageBuffer(
  itemId: number,
  buffer: Buffer,
  mimeType: string,
): string {
  const storagePath = getStorageRootPath();
  const imagesDir = path.join(storagePath, 'editor-images', String(itemId));
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const ext = EXT_MAP[mimeType] || '.png';
  const fileName = `${uuidv4()}${ext}`;
  const filePath = path.join(imagesDir, fileName);

  fs.writeFileSync(filePath, buffer);
  logger.info(`编辑器图片已保存: ${filePath}`);

  return `local-image:///${filePath.replace(/\\/g, '/')}`;
}

export function selectImageFile(): { filePath: string; localSrc: string } | null {
  const { dialog, BrowserWindow } = require('electron');
  const result = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow(), {
    title: '选择图片',
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
    ],
    properties: ['openFile'],
  });

  if (!result || result.length === 0) return null;

  const filePath = result[0];
  return {
    filePath,
    localSrc: `local-image:///${filePath.replace(/\\/g, '/')}`,
  };
}
