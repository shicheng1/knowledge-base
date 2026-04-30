import { createWorker, Worker } from 'tesseract.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getConfig } from '../utils/config';

/**
 * OCR 服务 - 使用 tesseract.js 识别图片中的文字。
 * 支持中文简繁 + 英文混合识别。
 */

let ocrStatus: 'idle' | 'running' = 'idle';

/**
 * 检查图片文件是否适合 OCR（大小、格式）
 */
async function validateImage(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size === 0) return false;
    if (stat.size > 50 * 1024 * 1024) return false; // 50MB limit

    const ext = path.extname(filePath).toLowerCase();
    const supportedExts = ['.png', '.jpg', '.jpeg', '.bmp', '.pbm', '.webp'];
    return supportedExts.includes(ext);
  } catch {
    return false;
  }
}

/**
 * 对单张图片执行 OCR 识别。
 * @param imagePath 图片文件路径
 * @returns 识别出的文字，失败时返回 null
 */
export async function recognizeImage(imagePath: string): Promise<string | null> {
  if (!(await validateImage(imagePath))) {
    return null;
  }

  if (ocrStatus === 'running') {
    return null; // 避免并发执行
  }

  ocrStatus = 'running';
  let worker: Worker | null = null;

  try {
    worker = await createWorker('chi_sim+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // progress can be logged if needed
        }
      },
    });

    const { data } = await worker.recognize(imagePath);
    const text = data.text?.trim() ?? '';

    return text || null;
  } catch (err) {
    console.error('[OCR] 识别失败:', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    ocrStatus = 'idle';
    if (worker) {
      try { await worker.terminate(); } catch {}
    }
  }
}

/**
 * 是否启用了 OCR 功能。
 */
export function isOcrEnabled(): boolean {
  try {
    const config = getConfig() as any;
    return config.ocrEnabled === true;
  } catch {
    return false;
  }
}

/**
 * 获取当前 OCR 状态。
 */
export function getOcrStatus(): 'idle' | 'running' {
  return ocrStatus;
}
