/**
 * 知识库保存助手 - Content Script
 *
 * 注入到网页中，负责提取页面内容并响应 background script 的请求。
 */

/**
 * 提取微信公众号文章内容
 */
async function getWechatArticleContent() {
  const contentEl = document.querySelector('#js_content');
  if (!contentEl) return null;

  const title = document.querySelector('#activity-name')?.textContent?.trim() || document.title;
  const author = document.querySelector('#js_name')?.textContent?.trim() || '';
  const publishDate = document.querySelector('#publish_time')?.textContent?.trim() || '';

  const html = contentEl.innerHTML;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  const summary = textContent.trim().slice(0, 200).replace(/\s+/g, ' ');

  const images = [];
  const imgElements = contentEl.querySelectorAll('img');
  for (const img of imgElements) {
    const dataSrc = (img.getAttribute('data-src') || '').trim();
    const rawSrc = (img.getAttribute('src') || '').trim();
    const variants = [...new Set(
      [dataSrc, rawSrc].filter(
        (u) => /^https?:\/\/.*\.qpic\.cn\//i.test(u),
      ),
    )];
    const fetchUrl =
      /\.qpic\.cn\//i.test(dataSrc) ? dataSrc : /\.qpic\.cn\//i.test(rawSrc) ? rawSrc : variants[0] || '';

    if (fetchUrl) {
      let dataUrl = '';
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'fetchImage', url: fetchUrl }, resolve);
        });
        dataUrl = response?.dataUrl || '';
      } catch (e) {
        console.warn('获取图片base64失败:', fetchUrl, e);
      }
      images.push({ src: fetchUrl, variants, alt: img.getAttribute('alt') || '', dataUrl });
    }
  }

  return {
    title,
    url: window.location.href,
    html,
    textContent,
    summary,
    author,
    publishDate,
    images,
    isWechat: true,
    selectedText: '',
    description: '',
    keywords: '',
    favicon: '',
  };
}

/**
 * 获取当前页面的完整内容
 * @returns {Object} 页面内容对象
 */
async function getPageContent() {
  if (window.location.hostname === 'mp.weixin.qq.com') {
    const wechatContent = await getWechatArticleContent();
    if (wechatContent) return wechatContent;
    return {
      title: document.querySelector('#activity-name')?.textContent?.trim() || document.title,
      url: window.location.href,
      html: '<p>正文区域未就绪，请等文章加载完成后重试保存。</p>',
      textContent: '',
      summary: '',
      author: document.querySelector('#js_name')?.textContent?.trim() || '',
      publishDate: document.querySelector('#publish_time')?.textContent?.trim() || '',
      images: [],
      isWechat: true,
      selectedText: window.getSelection().toString() || '',
      description: '',
      keywords: '',
      favicon: '',
    };
  }

  return {
    title: document.title || '',
    url: window.location.href || '',
    html: document.documentElement.outerHTML || '',
    selectedText: window.getSelection().toString() || '',
    description: getMetaDescription() || '',
    keywords: getMetaKeywords() || '',
    author: getMetaAuthor() || '',
    publishDate: getPublishDate() || '',
    favicon: getFavicon() || '',
    images: extractPageImages(),
    isWechat: false,
  };
}

/**
 * 提取页面中的图片列表
 */
function extractPageImages() {
  const images = [];
  document.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (src && !src.startsWith('data:') && src.length < 2000) {
      images.push({ src, alt: img.getAttribute('alt') || '' });
    }
  });
  return images;
}

function getMetaDescription() {
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute('content') : '';
}

function getMetaKeywords() {
  const meta = document.querySelector('meta[name="keywords"]');
  return meta ? meta.getAttribute('content') : '';
}

function getMetaAuthor() {
  const meta = document.querySelector('meta[name="author"]');
  return meta ? meta.getAttribute('content') : '';
}

function getPublishDate() {
  const dateSelectors = [
    'meta[name="date"]',
    'meta[name="publish-date"]',
    'meta[name="pubdate"]',
    'meta[property="article:published_time"]',
    'meta[name="DC.date.issued"]',
    'time[datetime]',
  ];

  for (const selector of dateSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      return el.getAttribute('content') || el.getAttribute('datetime') || el.textContent.trim();
    }
  }
  return '';
}

function getFavicon() {
  const link = document.querySelector(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  );
  if (link) {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('data:')) {
      try {
        return new URL(href, window.location.origin).href;
      } catch {
        return href;
      }
    }
  }
  return '';
}

if (!globalThis.__KB_CONTENT_LISTENER__) {
  globalThis.__KB_CONTENT_LISTENER__ = true;
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPageContent') {
      getPageContent()
        .then(content => sendResponse({ success: true, data: content }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (message.action === 'getSelectedText') {
      sendResponse({
        success: true,
        data: { selectedText: window.getSelection().toString() },
      });
      return true;
    }

    if (message.action === 'getSelectionInfo') {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        sendResponse({
          success: true,
          data: {
            selectedText: selection.toString(),
            selectedHtml: getSelectionHtml(selection),
          },
        });
      } else {
        sendResponse({ success: true, data: { selectedText: '', selectedHtml: '' } });
      }
      return true;
    }
  });
}

function getSelectionHtml(selection) {
  if (selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  const div = document.createElement('div');
  div.appendChild(range.cloneContents());
  return div.innerHTML;
}
