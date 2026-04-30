/**
 * 知识库保存助手 - Popup Script
 *
 * 负责 popup 界面的交互逻辑，包括获取标签页信息、
 * 与桌面应用通信、管理标签输入等。
 */

// ============================================================
// DOM 元素引用
// ============================================================
const pageTitleInput = document.getElementById('page-title');
const pageUrlInput = document.getElementById('page-url');
const folderSelect = document.getElementById('folder-select');
const tagInput = document.getElementById('tag-input');
const tagList = document.getElementById('tag-list');
const tagSuggestions = document.getElementById('tag-suggestions');
const noteInput = document.getElementById('note-input');
const saveBtn = document.getElementById('save-btn');
const statusMessage = document.getElementById('status-message');
const openSettingsLink = document.getElementById('open-settings');

// ============================================================
// 状态
// ============================================================
let currentTab = null;
let currentTags = [];
let availableTags = [];
let availableFolders = [];

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 获取当前标签页信息
    currentTab = await requestTabInfo();
    if (currentTab && !currentTab.error) {
      pageTitleInput.value = currentTab.title || '';
      pageUrlInput.value = currentTab.url || '';
    }

    // 从桌面应用获取文件夹列表和标签列表
    await Promise.allSettled([
      loadFolders(),
      loadTags()
    ]);
  } catch (error) {
    console.error('[知识库助手] 初始化失败:', error);
  }

  // 绑定事件
  bindEvents();
});

// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
  // 保存按钮
  saveBtn.addEventListener('click', handleSave);

  // 标签输入
  tagInput.addEventListener('keydown', handleTagInputKeydown);
  tagInput.addEventListener('input', handleTagInputChange);
  tagInput.addEventListener('blur', () => {
    setTimeout(() => hideTagSuggestions(), 200);
  });

  // 打开设置
  openSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    openDesktopAppSettings();
  });
}

// ============================================================
// 获取当前标签页信息
// ============================================================
function requestTabInfo() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getTabInfo' }, (response) => {
      resolve(response || { error: '无响应' });
    });
  });
}

// ============================================================
// 加载文件夹列表
// ============================================================
async function loadFolders() {
  try {
    const response = await sendToHost({ action: 'getFolders' });
    if (response && Array.isArray(response.folders)) {
      availableFolders = response.folders;
      populateFolderDropdown(response.folders);
    }
  } catch (error) {
    console.warn('[知识库助手] 无法加载文件夹列表:', error);
  }
}

/**
 * 填充文件夹下拉菜单
 * @param {Array} folders - 文件夹列表 [{id, name, path}]
 */
function populateFolderDropdown(folders) {
  // 清除现有选项（保留默认选项）
  while (folderSelect.options.length > 1) {
    folderSelect.remove(1);
  }

  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id || folder.path || folder.name;
    option.textContent = folder.name || folder.path;
    folderSelect.appendChild(option);
  });
}

// ============================================================
// 加载标签列表
// ============================================================
async function loadTags() {
  try {
    const response = await sendToHost({ action: 'getTags' });
    if (response && Array.isArray(response.tags)) {
      availableTags = response.tags;
    }
  } catch (error) {
    console.warn('[知识库助手] 无法加载标签列表:', error);
  }
}

// ============================================================
// 标签输入处理
// ============================================================

/**
 * 处理标签输入框按键事件
 * @param {KeyboardEvent} e
 */
function handleTagInputKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const tag = tagInput.value.trim().replace(/,/g, '');
    if (tag) {
      addTag(tag);
      tagInput.value = '';
      hideTagSuggestions();
    }
  }

  if (e.key === 'Backspace' && !tagInput.value && currentTags.length > 0) {
    removeTag(currentTags[currentTags.length - 1]);
  }
}

/**
 * 处理标签输入变化，显示建议
 */
function handleTagInputChange() {
  const value = tagInput.value.trim();
  if (value.length > 0) {
    showTagSuggestions(value);
  } else {
    hideTagSuggestions();
  }
}

/**
 * 添加标签
 * @param {string} tag
 */
function addTag(tag) {
  const normalized = tag.toLowerCase().trim();
  if (!normalized || currentTags.includes(normalized)) return;

  currentTags.push(normalized);
  renderTags();
}

/**
 * 移除标签
 * @param {string} tag
 */
function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTags();
}

/**
 * 渲染标签列表
 */
function renderTags() {
  tagList.innerHTML = '';
  currentTags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag-item';
    tagEl.innerHTML = `
      <span>${escapeHtml(tag)}</span>
      <button class="tag-remove" data-tag="${escapeHtml(tag)}" title="移除标签">&times;</button>
    `;
    tagEl.querySelector('.tag-remove').addEventListener('click', () => removeTag(tag));
    tagList.appendChild(tagEl);
  });
}

/**
 * 显示标签建议
 * @param {string} query
 */
function showTagSuggestions(query) {
  const lowerQuery = query.toLowerCase();
  const suggestions = availableTags.filter(
    tag => tag.toLowerCase().includes(lowerQuery) && !currentTags.includes(tag)
  ).slice(0, 8);

  if (suggestions.length === 0) {
    hideTagSuggestions();
    return;
  }

  tagSuggestions.innerHTML = '';
  suggestions.forEach(tag => {
    const item = document.createElement('button');
    item.className = 'tag-suggestion-item';
    item.textContent = tag;
    item.addEventListener('click', () => {
      addTag(tag);
      tagInput.value = '';
      hideTagSuggestions();
    });
    tagSuggestions.appendChild(item);
  });

  tagSuggestions.classList.add('visible');
}

/**
 * 隐藏标签建议
 */
function hideTagSuggestions() {
  tagSuggestions.classList.remove('visible');
  tagSuggestions.innerHTML = '';
}

// ============================================================
// 保存处理
// ============================================================

/**
 * 处理保存按钮点击
 */
async function handleSave() {
  // 验证
  const title = pageTitleInput.value.trim();
  const url = pageUrlInput.value.trim();

  if (!title && !url) {
    showStatus('error', '无法获取页面信息，请刷新页面后重试。');
    return;
  }

  // 设置加载状态
  setLoading(true);
  hideStatus();

  try {
    const saveData = {
      tabId: currentTab?.tabId,
      title: title,
      url: url,
      folder: folderSelect.value,
      tags: [...currentTags],
      note: noteInput.value.trim(),
      selectedText: ''
    };

    const response = await sendToHost({ action: 'savePage', data: saveData });

    if (response && response.success !== false) {
      showStatus('success', '已成功保存到知识库！');
      // 保存成功后可以关闭 popup
      setTimeout(() => window.close(), 1500);
    } else {
      const errorMsg = response?.error || '保存失败，请重试。';
      showStatus('error', errorMsg);
    }
  } catch (error) {
    let errorMsg = '保存失败，请检查桌面应用是否正在运行。';

    if (error.message.includes('未找到桌面应用')) {
      errorMsg = '未找到桌面应用，请先安装并启动知识库桌面应用。';
    } else if (error.message.includes('连接已断开')) {
      errorMsg = '与桌面应用的连接已断开，请重启桌面应用。';
    } else if (error.message) {
      errorMsg = `保存失败：${error.message}`;
    }

    showStatus('error', errorMsg);
  } finally {
    setLoading(false);
  }
}

// ============================================================
// 通过 background script 发送消息到桌面应用
// ============================================================

/**
 * 发送消息到桌面应用
 * @param {Object} message
 * @returns {Promise<Object>}
 */
function sendToHost(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'sendToHost', data: message },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.success) {
          resolve(response.data);
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    );
  });
}

// ============================================================
// 打开桌面应用设置
// ============================================================

function openDesktopAppSettings() {
  sendToHost({ action: 'openSettings' }).catch(error => {
    console.warn('[知识库助手] 无法打开设置:', error);
    showStatus('error', '无法打开桌面应用，请确保应用正在运行。');
  });
}

// ============================================================
// UI 辅助函数
// ============================================================

/**
 * 设置加载状态
 * @param {boolean} loading
 */
function setLoading(loading) {
  if (loading) {
    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;
  } else {
    saveBtn.classList.remove('is-loading');
    saveBtn.disabled = false;
  }
}

/**
 * 显示状态消息
 * @param {'success'|'error'} type
 * @param {string} message
 */
function showStatus(type, message) {
  const icon = type === 'success' ? '\u2713' : '\u2717';
  statusMessage.className = `status-message ${type}`;
  statusMessage.innerHTML = `
    <span class="status-icon">${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;
}

/**
 * 隐藏状态消息
 */
function hideStatus() {
  statusMessage.className = 'status-message hidden';
  statusMessage.innerHTML = '';
}

/**
 * HTML 转义
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
