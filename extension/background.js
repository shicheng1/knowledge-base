/**
 * 知识库保存助手 - Background Service Worker
 *
 * 负责管理右键菜单、与 popup 通信、注入 content script、
 * 以及通过 Native Messaging 与桌面应用通信。
 */

// ============================================================
// 安装时创建右键菜单
// ============================================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-knowledge-base',
    title: '保存到知识库',
    contexts: ['page', 'selection', 'link', 'image']
  });

  console.log('[知识库助手] 扩展已安装，右键菜单已创建。');
});

// ============================================================
// 右键菜单点击处理
// ============================================================
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-to-knowledge-base') return;

  try {
    const pageContent = await getPageContentFromTab(tab.id);

    if (!pageContent) {
      console.error('[知识库助手] 无法获取页面内容。');
      return;
    }

    const message = {
      type: 'save-page',
      data: {
        title: pageContent.title,
        url: pageContent.url,
        html: pageContent.html,
        selectedText: pageContent.selectedText || '',
        author: pageContent.author || '',
        publishDate: pageContent.publishDate || '',
        isWechat: pageContent.isWechat || false,
        images: pageContent.images || [],
        folderId: undefined,
        tags: [],
      }
    };

    const response = await sendMessageToHost(message);
    console.log('[知识库助手] 保存结果:', response);

    showNotification(tab.id, response && response.success !== false);
  } catch (error) {
    console.error('[知识库助手] 右键保存失败:', error);
  }
});

// ============================================================
// 从标签页获取页面内容
// 先注入 content.js，再通过消息获取 content.js 提取的内容
// ============================================================
async function getPageContentFromTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (e) {
    console.warn('[知识库助手] 注入 content.js 失败，尝试内联提取:', e);
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'getPageContent' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        console.warn('[知识库助手] content.js 消息获取失败，使用内联提取');
        fallbackGetContent(tabId).then(resolve);
        return;
      }
      resolve(response.data);
    });
  });
}

async function fallbackGetContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title,
      url: window.location.href,
      html: document.documentElement.outerHTML,
      selectedText: window.getSelection().toString(),
      isWechat: false,
      images: [],
      author: '',
      publishDate: '',
    })
  });
  return results[0]?.result || null;
}

// ============================================================
// 在页面中显示通知
// ============================================================
function showNotification(tabId, success) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (success) => {
      const notification = document.createElement('div');
      notification.textContent = success ? '已保存到知识库' : '保存失败，请重试';
      Object.assign(notification.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        padding: '10px 20px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '2147483647',
        backgroundColor: success ? '#22c55e' : '#ef4444',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'opacity 0.3s ease'
      });
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 2500);
    },
    args: [success]
  });
}

// ============================================================
// 点击扩展图标时
// ============================================================
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[知识库助手] 扩展图标被点击，当前标签页:', tab.id);
});

// ============================================================
// 监听来自 popup 的消息
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          tabId: tabs[0].id,
          title: tabs[0].title,
          url: tabs[0].url,
          favIconUrl: tabs[0].favIconUrl || ''
        });
      } else {
        sendResponse({ error: '无法获取当前标签页信息' });
      }
    });
    return true;
  }

  if (message.action === 'savePage') {
    handleSaveRequest(message.data, sendResponse);
    return true;
  }

  if (message.action === 'fetchImage') {
    fetch(message.url, {
      headers: { 'Referer': 'https://mp.weixin.qq.com/' }
    })
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ dataUrl: reader.result });
        reader.readAsDataURL(blob);
      })
      .catch(err => sendResponse({ dataUrl: null, error: err.message }));
    return true;
  }

  if (message.action === 'sendToHost') {
    sendMessageToHost(message.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ============================================================
// 处理保存请求：获取页面内容后发送到桌面应用
// ============================================================
async function handleSaveRequest(saveData, sendResponse) {
  try {
    const tabId = saveData.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: '缺少标签页 ID' });
      return;
    }

    const pageContent = await getPageContentFromTab(tabId);

    if (!pageContent) {
      sendResponse({ success: false, error: '无法获取页面内容' });
      return;
    }

    const message = {
      type: 'save-page',
      data: {
        title: saveData.title || pageContent.title,
        url: saveData.url || pageContent.url,
        html: pageContent.html,
        selectedText: pageContent.selectedText || saveData.selectedText || '',
        author: pageContent.author || '',
        publishDate: pageContent.publishDate || '',
        isWechat: pageContent.isWechat || false,
        images: pageContent.images || [],
        folderId: saveData.folderId,
        tags: saveData.tags || [],
      }
    };

    const response = await sendMessageToHost(message);
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error('[知识库助手] 保存失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================
// 通过 HTTP 优先，Native Messaging 后备的方式发送消息到桌面应用
// ============================================================
async function sendMessageToHost(message) {
  // 优先尝试 HTTP 通信（适用于 npm run dev 开发模式）
  try {
    const httpResult = await tryHttpSend(message);
    if (httpResult !== null) {
      return httpResult;
    }
  } catch (e) {
    console.log('[知识库助手] HTTP 请求失败，尝试 Native Messaging:', e.message);
  }

  // 回退：Native Messaging
  return sendViaNativeMessaging(message);
}

/**
 * 尝试通过 HTTP API 发送消息（需主应用正在运行）
 */
async function tryHttpSend(message) {
  const API_BASE = 'http://localhost:17321';

  switch (message.type) {
    case 'save-page': {
      const response = await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: message.data.url,
          title: message.data.title,
          html: message.data.html,
          folderId: message.data.folderId,
          tags: message.data.tags,
        })
      });
      if (response.ok) {
        const result = await response.json();
        return { type: 'save-page-result', success: true, data: result.data || null };
      }
      const err = await response.json().catch(() => ({}));
      return { type: 'save-page-result', success: false, error: err.error || '未知错误' };
    }

    case 'get-folders': {
      const response = await fetch(`${API_BASE}/api/folders`);
      if (response.ok) {
        const result = await response.json();
        return { type: 'folders-result', success: true, data: result.data || [] };
      }
      return { type: 'folders-result', success: false, error: '获取文件夹失败' };
    }

    case 'get-tags': {
      const response = await fetch(`${API_BASE}/api/tags`);
      if (response.ok) {
        const result = await response.json();
        return { type: 'tags-result', success: true, data: result.data || [] };
      }
      return { type: 'tags-result', success: false, error: '获取标签失败' };
    }

    default:
      // 不支持的消息类型，交由 Native Messaging 处理
      return null;
  }
}

/**
 * 通过 Native Messaging 发送消息
 */
function sendViaNativeMessaging(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(
        'com.knowledgebase.host',
        message,
        (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.error('[知识库助手] Native Messaging 错误:', errorMsg);

            if (errorMsg.includes('Specified native messaging host not found')) {
              reject(new Error('未找到桌面应用，请确保知识库桌面应用已安装并运行。'));
            } else if (errorMsg.includes('disconnected')) {
              reject(new Error('与桌面应用的连接已断开，请检查桌面应用是否正在运行。'));
            } else {
              reject(new Error(errorMsg));
            }
            return;
          }

          if (response) {
            resolve(response);
          } else {
            resolve({ success: true });
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}
