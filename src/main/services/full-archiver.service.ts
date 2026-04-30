import { BrowserWindow, session } from 'electron';
import { logger } from '../utils/logger';

interface ArchiveResult {
  url: string;
  title: string;
  html: string;
  textContent: string;
}

const INLINE_SCRIPT = `(async () => {
  const absolutize = (rel) => {
    try { return new URL(rel, location.href).href; } catch { return rel; }
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  const fetchAsDataUrl = async (url) => {
    try {
      const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      // 跳过过大的资源（>3MB）
      if (blob.size > 3 * 1024 * 1024) return null;
      return await blobToDataUrl(blob);
    } catch { return null; }
  };

  // 内联样式表
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;
    try {
      const res = await fetch(absolutize(href));
      if (!res.ok) continue;
      const css = await res.text();
      const style = document.createElement('style');
      style.setAttribute('data-from', href);
      style.textContent = css;
      link.replaceWith(style);
    } catch {}
  }

  // 移除 script
  document.querySelectorAll('script').forEach((s) => s.remove());
  // 移除 noscript
  document.querySelectorAll('noscript').forEach((n) => n.remove());

  // 内联图片
  const imgs = Array.from(document.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:')) continue;
    const dataUrl = await fetchAsDataUrl(absolutize(src));
    if (dataUrl) {
      img.setAttribute('src', dataUrl);
      img.removeAttribute('srcset');
    }
  }

  // 修复链接为绝对地址
  document.querySelectorAll('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (h && !h.startsWith('#') && !h.startsWith('data:') && !h.startsWith('javascript:')) {
      a.setAttribute('href', absolutize(h));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // 注入 base 防止后续相对路径
  if (!document.querySelector('base')) {
    const base = document.createElement('base');
    base.href = location.href;
    document.head.insertBefore(base, document.head.firstChild);
  }

  return {
    title: document.title || '',
    html: '<!DOCTYPE html>\\n' + document.documentElement.outerHTML,
    textContent: document.body?.innerText || '',
  };
})()`;

export const archiveFullPage = async (
  url: string,
  timeoutMs: number = 30000,
): Promise<ArchiveResult> => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      offscreen: false,
      sandbox: true,
      contextIsolation: true,
      session: session.fromPartition('persist:archive'),
    },
  });

  try {
    const loadPromise = win.loadURL(url);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('页面加载超时')), timeoutMs),
    );
    await Promise.race([loadPromise, timeout]);

    // 等待主资源加载稳定
    await new Promise((r) => setTimeout(r, 1500));

    const result = (await win.webContents.executeJavaScript(INLINE_SCRIPT, true)) as ArchiveResult;
    result.url = url;
    return result;
  } catch (err) {
    logger.error('完整存档失败:', err);
    throw err;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
};
