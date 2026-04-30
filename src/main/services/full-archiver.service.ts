import { BrowserWindow, session, type WebContents } from 'electron';
import { JSDOM } from 'jsdom';
import { downloadUrlToBuffer, sanitizeWechatSectionsForTipTap } from './image-downloader';
import { logger } from '../utils/logger';

interface ArchiveResult {
  url: string;
  title: string;
  html: string;
  textContent: string;
}

const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function waitWechatArticleReady(webContents: WebContents): Promise<boolean> {
  const deadline = Date.now() + 22000;
  while (Date.now() < deadline) {
    try {
      const ok = await webContents.executeJavaScript(`(() => {
        const el = document.querySelector('#js_content');
        if (!el) return false;
        const t = (el.innerText || '').trim().length;
        const h = (el.innerHTML || '').length;
        return t > 35 || (h > 900 && el.querySelector('img,section,p[class]'));
      })()`, true);
      if (ok) return true;
    } catch {
      //
    }
    await new Promise((r) => setTimeout(r, 450));
  }
  logger.warn('[Archiver] 等待 #js_content 超时');
  return false;
}

/** 砍掉微信头里 script 类 link，避免 modulepreload 残留在最终 HTML 字符串里 */
function scrubWxArchivedHtml(html: string): string {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    const hr = /\bhref\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    const rel = (/\brel\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '').toLowerCase();
    const h = hr.toLowerCase();
    if (rel.includes('stylesheet')) return tag;
    if (rel.includes('icon')) return tag;
    if (rel.includes('canonical')) return tag;
    if (rel.includes('modulepreload')) return '';
    if (rel.includes('prefetch')) return '';
    if (rel.includes('preload') && (/as\s*=\s*["']script["']/i.test(tag) || /\.js(\?|'|"|$)/i.test(h)))
      return '';
    if (rel.includes('dns-prefetch') || rel.includes('preconnect')) return '';
    if (/res\.wx\.qq\.com/.test(h) && /\.js(\?|'|"|$)/i.test(h)) return '';
    if (/mmbizappmsg.*\.js/i.test(h)) return '';
    return tag;
  });
}

function decodeWxAttrAmp(s: string): string {
  return s.replace(/&amp;/g, '&');
}

function hasWxQpicUrl(u: string): boolean {
  return /^https:\/\/.+/i.test(u) && /\.qpic\.cn\//i.test(u);
}

function sniffImageMimeArchive(buf: Buffer, hint: string): string {
  const h = hint.toLowerCase();
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  if (
    buf.length >= 6 &&
    (buf.subarray(0, 6).toString('latin1') === 'GIF87a' ||
      buf.subarray(0, 6).toString('latin1') === 'GIF89a')
  )
    return 'image/gif';
  if (h.includes('wx_fmt=png')) return 'image/png';
  if (/wx_fmt=jpe?g/.test(h)) return 'image/jpeg';
  if (h.includes('wx_fmt=webp')) return 'image/webp';
  if (h.includes('wx_fmt=gif')) return 'image/gif';
  return 'image/jpeg';
}

async function embedWechatArchivedImagesViaMain(html: string): Promise<string> {
  const dom = new JSDOM(html, { contentType: 'text/html;charset=utf-8' });
  const imgs = [...dom.window.document.querySelectorAll('img')];
  const cacheNorm = new Map<string, string>();
  let dlIx = 0;

  for (const img of imgs) {
    const ds = decodeWxAttrAmp(img.getAttribute('data-src') ?? '').trim();
    const sk = decodeWxAttrAmp(img.getAttribute('src') ?? '').trim();
    let pick: string | null = null;
    if (hasWxQpicUrl(ds)) pick = ds;
    else if (hasWxQpicUrl(sk)) pick = sk;
    if (!pick) continue;

    const memoKey = pick.split('#')[0];
    let inlined = cacheNorm.get(memoKey);
    if (!inlined) {
      if (dlIx++ > 0) await new Promise((resolve) => setTimeout(resolve, 90));
      const buf = await downloadUrlToBuffer(pick);
      if (!buf || buf.length < 32) continue;
      const mime = sniffImageMimeArchive(buf, pick);
      inlined = `data:${mime};base64,${buf.toString('base64')}`;
      cacheNorm.set(memoKey, inlined);
    }

    img.setAttribute('src', inlined);
    img.removeAttribute('data-src');
    img.removeAttribute('srcset');
  }

  const out = dom.serialize();
  logger.info(`[Archiver] 微信图内联完成 (${imgs.length} 个节点)`);
  return out;
}

const INLINE_SCRIPT = `(async () => {
  const absolutize = (rel) => {
    try { return new URL(rel, location.href).href; } catch { return rel; }
  };

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  const fetchAsDataUrl = async (url) => {
    try {
      const headers = location.hostname === 'mp.weixin.qq.com' && /mmbiz\\.qpic\\.cn|qpic\\.cn/i.test(url)
        ? { Referer: 'https://mp.weixin.qq.com/' }
        : {};
      const res = await fetch(url, { credentials: 'include', mode: 'cors', headers });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size > 3 * 1024 * 1024) return null;
      return await blobToDataUrl(blob);
    } catch { return null; }
  };

  let resolvedTitle = document.title || '';
  if (location.hostname === 'mp.weixin.qq.com') {
    const an = document.querySelector('#activity-name');
    if (an?.textContent?.trim()) resolvedTitle = an.textContent.trim();
  }

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

  document.querySelectorAll('script').forEach((s) => s.remove());
  document.querySelectorAll('noscript').forEach((n) => n.remove());

  document.querySelectorAll(
    'link[rel="modulepreload"], link[rel="modulepreconnect"], link[rel="prefetch"], link[rel="dns-prefetch"]',
  ).forEach((n) => n.remove());
  document.querySelectorAll('link[rel="preload"]').forEach((l) => {
    const as = l.getAttribute('as');
    const href = l.getAttribute('href') || '';
    if (as === 'script' || as === 'fetch' || /\\.js($|[?#])/i.test(href)) l.remove();
  });

  const wxHost = location.hostname === 'mp.weixin.qq.com';

  if (wxHost && document.querySelector('#js_content')) {
    const jsRoot = document.querySelector('#js_content');
    if (jsRoot) {
      const authorEl = document.querySelector('#js_name');
      const dateEl = document.querySelector('#publish_time');
      const meta = [
        authorEl?.textContent?.trim(),
        dateEl?.textContent?.trim(),
      ].filter(Boolean).join(' · ');
      const headHtml = [
        resolvedTitle ? '<h1 class="kb-wx-title">' + esc(resolvedTitle) + '</h1>' : '',
        meta ? '<p class="kb-wx-meta">' + esc(meta) + '</p>' : '',
      ].join('');
      document.body.innerHTML = '<article class="kb-wx-article">' + headHtml + jsRoot.innerHTML + '</article>';
    }
  }

  if (!wxHost) {
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const img of imgs) {
      const raw = img.getAttribute('data-src') || img.getAttribute('src') || '';
      const trySrc = raw || img.currentSrc || img.src;
      if (!trySrc || trySrc.startsWith('data:')) continue;
      const dataUrl = await fetchAsDataUrl(absolutize(trySrc));
      if (dataUrl) {
        img.setAttribute('src', dataUrl);
        img.removeAttribute('srcset');
        img.removeAttribute('data-src');
      }
    }
  }

  document.querySelectorAll('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (h && !h.startsWith('#') && !h.startsWith('data:') && !h.startsWith('javascript:')) {
      a.setAttribute('href', absolutize(h));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  if (!document.querySelector('base')) {
    const base = document.createElement('base');
    base.href = location.href;
    document.head.insertBefore(base, document.head.firstChild);
  }

  document.querySelectorAll('link[rel="modulepreload"], link[rel="prefetch"]').forEach((n) => n.remove());

  return {
    title: resolvedTitle,
    html: '<!DOCTYPE html>\\n' + document.documentElement.outerHTML,
    textContent: document.body?.innerText || '',
  };
})()`;

export const archiveFullPage = async (
  url: string,
  timeoutMs: number = 45000,
): Promise<ArchiveResult> => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      offscreen: false,
      sandbox: false,
      contextIsolation: true,
      session: session.fromPartition('persist:archive'),
    },
  });

  try {
    win.webContents.setUserAgent(CHROME_DESKTOP_UA);
    const loadPromise = win.loadURL(url);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('页面加载超时')), timeoutMs),
    );
    await Promise.race([loadPromise, timeout]);

    const isWx = /^https:\/\/mp\.weixin\.qq\.com\//i.test(url);
    if (isWx) await waitWechatArticleReady(win.webContents);
    else await new Promise((r) => setTimeout(r, 1500));

    const result = (await win.webContents.executeJavaScript(INLINE_SCRIPT, true)) as ArchiveResult;
    result.url = url;
    if (isWx) {
      try {
        result.html = await embedWechatArchivedImagesViaMain(result.html);
      } catch (e) {
        logger.warn('[Archiver] 主进程微信图内联失败', e);
      }
      result.html = sanitizeWechatSectionsForTipTap(result.html);
    }
    if (isWx || /\/\/mp\.weixin\.qq\.com/i.test(result.html)) {
      result.html = scrubWxArchivedHtml(result.html);
    }
    return result;
  } catch (err) {
    logger.error('完整存档失败:', err);
    throw err;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
};
