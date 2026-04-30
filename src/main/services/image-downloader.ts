import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { getStorageRootPath } from '../utils/config';
import { logger } from '../utils/logger';

interface ImageInfo {
  src: string;
  alt?: string;
}

export async function downloadImagesToLocal(
  images: ImageInfo[],
  pageUrl: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!images || images.length === 0) return result;

  const storagePath = getStorageRootPath();
  const imagesDir = path.join(storagePath, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const timestamp = Date.now();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let src = img.src;

    if (!src || src.startsWith('data:')) continue;

    try {
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        try {
          const baseUrl = new URL(pageUrl);
          src = new URL(src, baseUrl.origin).href;
        } catch {
          continue;
        }
      }

      const ext = guessExtension(src, img.alt);
      const fileName = `img_${timestamp}_${i}${ext}`;
      const filePath = path.join(imagesDir, fileName);

      await downloadFile(src, filePath);

      result[img.src] = filePath;
      logger.info(`下载图片成功: ${src} -> ${filePath}`);
    } catch (err) {
      logger.warn(`下载图片失败: ${src}`, err);
    }
  }

  return result;
}

export function saveBase64Image(dataUrl: string, timestamp: number, index: number): string | null {
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;

  const mimeType = matches[1];
  const base64Data = matches[2];

  const extMap: Record<string, string> = {
    png: '.png',
    jpeg: '.jpg',
    jpg: '.jpg',
    gif: '.gif',
    webp: '.webp',
    bmp: '.bmp',
    svg: '.svg+xml',
  };

  const ext = extMap[mimeType] || '.png';
  const storagePath = getStorageRootPath();
  const imagesDir = path.join(storagePath, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const fileName = `img_${timestamp}_${index}${ext}`;
  const filePath = path.join(imagesDir, fileName);

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

function guessExtension(url: string, alt?: string): string {
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore
  }
  return '.jpg';
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
