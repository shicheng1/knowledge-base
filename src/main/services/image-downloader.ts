import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { JSDOM } from 'jsdom';
import { getStorageRootPath } from '../utils/config';
import { logger } from '../utils/logger';

interface ImageInfo {
  src: string;
  alt?: string;
  variants?: string[];
}

interface ImageInfoWithDataUrl extends ImageInfo {
  dataUrl?: string;
  variants?: string[];
}

function uniqStrings(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))]
}

function srcMatchVariants(originalSrc: string): string[] {
  const bases = uniqStrings([
    originalSrc,
    originalSrc.replace(/#imgIndex=\d+/i, ''),
  ])
  const out: string[] = []
  for (const s of bases) {
    out.push(s, s.replace(/&/g, '&amp;'), s.replace(/&amp;/g, '&'))
  }
  return [...new Set(out.filter(Boolean))]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 占位 src 写在前面时浏览器会沿用 svg，删掉多余占位保留 local / qpic */
function scrubWechatImgPlaceholderSrc(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (_, attrs: string) => {
    const hasSvg = /data:image\/svg\+xml/i.test(attrs)
    const hasReal =
      /local-image:\/\//.test(attrs) ||
      /\.qpic\.cn\//i.test(attrs)
    if (!(hasSvg && hasReal)) return `<img ${attrs}>`
    const next = attrs
      .replace(/\bsrc\s*=\s*["']data:image\/svg\+xml[^"']*["']\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return `<img ${next}>`
  })
}

/** 微信正文里 section 包图，TipTap/StarterKit 不认，展成 p 或摘掉 section */
export function sanitizeWechatSectionsForTipTap(html: string): string {
  const dom = new JSDOM(html, { contentType: 'text/html;charset=utf-8' });
  const { document } = dom.window;
  const roots = [
    ...document.querySelectorAll('article'),
    ...(document.querySelector('article') ? [] : document.querySelectorAll('#js_content')),
  ];

  for (const root of roots) {
    const sections = [...root.children].filter((c) => c.tagName.toLowerCase() === 'section');
    for (const section of sections) {
      const parent = section.parentElement;
      if (!parent) continue;
      const elems = [...section.children];
      if (elems.length === 0) {
        section.remove();
        continue;
      }
      const allImg = elems.every((c) => c.tagName.toLowerCase() === 'img');

      if (allImg) {
        for (const img of elems) {
          section.removeChild(img);
          const p = document.createElement('p');
          p.appendChild(img);
          parent.insertBefore(p, section);
        }
        section.remove();
        continue;
      }

      while (section.firstChild) {
        parent.insertBefore(section.firstChild, section);
      }
      section.remove();
    }
  }

  return dom.serialize();
}

export async function processImagesAndReplaceHtml(
  html: string,
  images: ImageInfoWithDataUrl[] | undefined,
  pageUrl: string,
  isWechat?: boolean,
): Promise<string> {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return isWechat ? sanitizeWechatSectionsForTipTap(html) : html;
  }

  const timestamp = Date.now();
  const imageMap: Record<string, string> = {};
  const savedPathByDataUrl = new Map<string, string>();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      if (img.dataUrl) {
        let localPath = savedPathByDataUrl.get(img.dataUrl);
        if (!localPath) {
          localPath = saveBase64Image(img.dataUrl, timestamp, i);
          if (localPath) savedPathByDataUrl.set(img.dataUrl, localPath);
        }
        if (localPath) {
          const keys = uniqStrings([img.src, ...(img.variants || [])]);
          for (const k of keys) imageMap[k] = localPath;
          logger.info(`保存base64图片成功: ${img.src} -> ${localPath}`);
        }
      }
    } catch (err) {
      logger.warn(`保存base64图片失败: ${img.src}`, err);
    }
  }

  const needDownload = images.filter(img => !img.dataUrl && img.src && !img.src.startsWith('data:'));
  if (needDownload.length > 0) {
    try {
      const downloadedMap = await downloadImagesToLocal(needDownload, pageUrl);
      for (const [orig, p] of Object.entries(downloadedMap)) {
        imageMap[orig] = p;
        const row = needDownload.find((x) => x.src === orig);
        for (const v of row?.variants || []) imageMap[v] = p;
      }
    } catch (imgErr) {
      logger.warn('图片下载失败，继续保存:', imgErr);
    }
  }

  let result = html;
  for (const [originalSrc, localPath] of Object.entries(imageMap)) {
    const fileUrl = `local-image:///${localPath.replace(/\\/g, '/')}`;
    for (const variant of srcMatchVariants(originalSrc)) {
      const escapedSrc = escapeRegex(variant);
      result = result.replace(
        new RegExp(`data-src\\s*=\\s*["']${escapedSrc}["']`, 'gi'),
        `src="${fileUrl}"`,
      );
      result = result.replace(
        new RegExp(`src\\s*=\\s*["']${escapedSrc}["']`, 'gi'),
        `src="${fileUrl}"`,
      );
    }
  }

  if (isWechat) {
    result = scrubWechatImgPlaceholderSrc(result);
    result = result.replace(/\s*data-src\s*=\s*["'][^"']*["']/g, '');
    result = sanitizeWechatSectionsForTipTap(result);
  }

  return result;
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
  const matches = dataUrl.match(/^data:image\/([\w+.+-]+);base64,(.+)$/);
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
    svg: '.svg',
    'svg+xml': '.svg',
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

/** 供存档等不走 CORS 的场景拉取远端图片二进制 */
export function downloadUrlToBuffer(urlStr: string, redirectBudget = 4): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (b: Buffer | null) => {
      if (settled) return
      settled = true
      resolve(b && b.length > 0 ? b : null)
    }

    try {
      const proto = urlStr.startsWith('https') ? https : http
      const opts: { timeout: number; headers?: Record<string, string> } = {
        timeout: 20000,
        ...( /\.qpic\.cn\b/i.test(urlStr)
          ? {
              headers: {
                Referer: 'https://mp.weixin.qq.com/',
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              },
            }
          : {}),
      }

      const req = proto.get(urlStr, opts, (response) => {
        const code = response.statusCode ?? 0
        if (
          redirectBudget > 0 &&
          code >= 300 &&
          code < 400 &&
          response.headers.location
        ) {
          let nextLoc = response.headers.location
          try {
            nextLoc = new URL(nextLoc, urlStr).href
          } catch {
            settle(null)
            return
          }
          response.resume()
          void downloadUrlToBuffer(nextLoc, redirectBudget - 1).then(settle)
          return
        }

        if (code < 200 || code >= 300) {
          response.resume()
          settle(null)
          return
        }

        const chunks: Buffer[] = []
        response.on('data', (c: Buffer) => chunks.push(c))
        response.on('end', () => settle(Buffer.concat(chunks)))
        response.on('error', () => settle(null))
      })

      req.on('error', () => settle(null))
      req.on('timeout', () => {
        req.destroy()
        settle(null)
      })
    } catch {
      settle(null)
    }
  })
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const opts: { timeout: number; headers?: Record<string, string> } = {
      timeout: 10000,
      ...( /\.qpic\.cn\b/i.test(url)
        ? { headers: { Referer: 'https://mp.weixin.qq.com/' } }
        : {}),
    };

    const request = protocol.get(url, opts, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let nextUrl: string;
        try {
          nextUrl = new URL(response.headers.location, url).href;
        } catch {
          reject(new Error(`Invalid redirect Location: ${response.headers.location}`));
          return;
        }
        downloadFile(nextUrl, destPath).then(resolve).catch(reject);
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
