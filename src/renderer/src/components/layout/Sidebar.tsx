import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Star,
  Search,
  Settings,
  FolderOpen,
  Tag,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  BarChart3,
  Network,
  Rss,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { folderApi, tagApi } from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
interface FolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  children?: FolderNode[];
}

interface TagItem {
  id: number;
  name: string;
  color: string;
}

/* 预设标签颜色 */
const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

/* ------------------------------------------------------------------ */
/*  文件夹树节点组件                                                     */
/* ------------------------------------------------------------------ */
const FolderTreeNode: React.FC<{
  folder: FolderNode;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, folder: FolderNode) => void;
}> = ({ folder, depth, expandedIds, onToggle, onContextMenu }) => {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedIds.has(folder.id);

  return (
    <div>
      <NavLink
        to={`/folder/${folder.id}`}
        onContextMenu={(e) => onContextMenu(e, folder)}
        className={({ isActive }) =>
          `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-100 ${
            isActive ? 'bg-blue-50 font-medium text-blue-600' : 'text-gray-700'
          }`
        }
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggle(folder.id);
            }}
            className="flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <FolderOpen className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <span className="truncate">{folder.name}</span>
      </NavLink>

      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  侧边栏组件                                                         */
/* ------------------------------------------------------------------ */
const Sidebar: React.FC = () => {
  const location = useLocation();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [tagsExpanded, setTagsExpanded] = useState(true);

  /* 新建文件夹 */
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  /* 文件夹右键菜单 */
  const [contextMenuFolder, setContextMenuFolder] = useState<FolderNode | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  /* 重命名文件夹 */
  const [showRenameFolder, setShowRenameFolder] = useState(false);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null);

  /* 新建标签 */
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  /* 标签右键菜单 */
  const [contextMenuTag, setContextMenuTag] = useState<TagItem | null>(null);
  const [contextMenuTagPos, setContextMenuTagPos] = useState({ x: 0, y: 0 });

  /* 编辑标签 */
  const [showEditTag, setShowEditTag] = useState(false);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [editTagId, setEditTagId] = useState<number | null>(null);

  /* 用于点击其他地方关闭右键菜单 */
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const tagContextMenuRef = useRef<HTMLDivElement>(null);

  /* 加载文件夹树 */
  const loadFolders = useCallback(async () => {
    try {
      const tree = await folderApi.getTree();
      setFolders(tree ?? []);
    } catch (err) {
      console.error('加载文件夹树失败:', err);
    }
  }, []);

  /* 加载标签列表 */
  const loadTags = useCallback(async () => {
    try {
      const list = await tagApi.getAll();
      setTags(list ?? []);
    } catch (err) {
      console.error('加载标签失败:', err);
    }
  }, []);

  useEffect(() => {
    loadFolders();
    loadTags();
  }, [loadFolders, loadTags]);

  /* 点击空白处关闭右键菜单 */
  useEffect(() => {
    const handleClick = () => {
      setContextMenuFolder(null);
      setContextMenuTag(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  /* 切换文件夹展开/折叠 */
  const toggleFolder = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /* ---------- 文件夹操作 ---------- */

  /* 创建文件夹 */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await folderApi.create({ name: newFolderName.trim(), parent_id: null });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
    } catch (err: any) {
      alert('创建文件夹失败: ' + (err?.message ?? '未知错误'));
    }
  };

  /* 文件夹右键菜单 */
  const handleFolderContextMenu = (e: React.MouseEvent, folder: FolderNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuFolder(folder);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuTag(null);
  };

  /* 重命名文件夹 */
  const handleRenameFolder = () => {
    if (!contextMenuFolder) return;
    setRenameFolderId(contextMenuFolder.id);
    setRenameFolderName(contextMenuFolder.name);
    setShowRenameFolder(true);
    setContextMenuFolder(null);
  };

  const handleRenameFolderConfirm = async () => {
    if (!renameFolderName.trim() || renameFolderId === null) return;
    try {
      await folderApi.update(renameFolderId, { name: renameFolderName.trim() });
      setShowRenameFolder(false);
      setRenameFolderName('');
      setRenameFolderId(null);
      loadFolders();
    } catch (err: any) {
      alert('重命名失败: ' + (err?.message ?? '未知错误'));
    }
  };

  /* 删除文件夹 */
  const handleDeleteFolder = () => {
    if (!contextMenuFolder) return;
    const folder = contextMenuFolder;
    setContextMenuFolder(null);
    if (confirm(`确定删除文件夹「${folder.name}」吗？该操作不可恢复。`)) {
      folderApi.delete(folder.id).then(() => {
        loadFolders();
      }).catch((err: any) => {
        alert('删除失败: ' + (err?.message ?? '未知错误'));
      });
    }
  };

  /* ---------- 标签操作 ---------- */

  /* 创建标签 */
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await tagApi.create(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor(PRESET_COLORS[0]);
      setShowNewTag(false);
      loadTags();
    } catch (err: any) {
      alert('创建标签失败: ' + (err?.message ?? '未知错误'));
    }
  };

  /* 标签右键菜单 */
  const handleTagContextMenu = (e: React.MouseEvent, tag: TagItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuTag(tag);
    setContextMenuTagPos({ x: e.clientX, y: e.clientY });
    setContextMenuFolder(null);
  };

  /* 编辑标签 */
  const handleEditTag = () => {
    if (!contextMenuTag) return;
    setEditTagId(contextMenuTag.id);
    setEditTagName(contextMenuTag.name);
    setEditTagColor(contextMenuTag.color);
    setShowEditTag(true);
    setContextMenuTag(null);
  };

  const handleEditTagConfirm = async () => {
    if (!editTagName.trim() || editTagId === null) return;
    try {
      await tagApi.update(editTagId, { name: editTagName.trim(), color: editTagColor });
      setShowEditTag(false);
      setEditTagName('');
      setEditTagColor('');
      setEditTagId(null);
      loadTags();
    } catch (err: any) {
      alert('编辑标签失败: ' + (err?.message ?? '未知错误'));
    }
  };

  /* 删除标签 */
  const handleDeleteTag = () => {
    if (!contextMenuTag) return;
    const tag = contextMenuTag;
    setContextMenuTag(null);
    if (confirm(`确定删除标签「${tag.name}」吗？`)) {
      tagApi.delete(tag.id).then(() => {
        loadTags();
      }).catch((err: any) => {
        alert('删除失败: ' + (err?.message ?? '未知错误'));
      });
    }
  };

  /* 导航链接配置 */
  const navItems = [
    { to: '/', label: '全部条目', icon: Home },
    { to: '/favorites', label: '收藏', icon: Star },
    { to: '/feed', label: '知识流', icon: Rss },
    { to: '/graph', label: '知识图谱', icon: Network },
    { to: '/stats', label: '统计', icon: BarChart3 },
    { to: '/search', label: '搜索', icon: Search },
    { to: '/trash', label: '回收站', icon: Trash2 },
    { to: '/settings', label: '设置', icon: Settings },
  ];

  /* 颜色选择器组件 */
  const ColorPicker: React.FC<{
    color: string;
    onChange: (c: string) => void;
  }> = ({ color, onChange }) => (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
            color === c ? 'border-gray-800 scale-110' : 'border-transparent'
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* 应用标题 */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
          知
        </div>
        <h1 className="text-lg font-semibold text-gray-800">知识库</h1>
      </div>

      {/* 主导航 */}
      <nav className="space-y-0.5 px-3 py-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 分隔线 */}
      <div className="mx-4 border-t border-gray-200" />

      {/* 文件夹树 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex w-full items-center justify-between rounded-md px-3 py-1.5">
          <button
            type="button"
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
          >
            {foldersExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>文件夹</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="新建文件夹"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {foldersExpanded && (
          <div className="mt-1 space-y-0.5">
            {folders.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-gray-400">暂无文件夹</p>
            )}
            {folders.map((folder) => (
              <FolderTreeNode
                key={folder.id}
                folder={folder}
                depth={0}
                expandedIds={expandedIds}
                onToggle={toggleFolder}
                onContextMenu={handleFolderContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* 标签区域 */}
      <div className="border-t border-gray-200 px-3 py-3">
        <div className="flex w-full items-center justify-between rounded-md px-3 py-1.5">
          <button
            type="button"
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600"
          >
            {tagsExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>标签</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewTag(true)}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="新建标签"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {tagsExpanded && (
          <div className="mt-1 flex flex-wrap gap-1.5 px-2">
            {tags.length === 0 && (
              <p className="text-xs text-gray-400">暂无标签</p>
            )}
            {tags.map((tag) => (
              <NavLink
                key={tag.id}
                to={`/search?tag=${tag.id}`}
                onContextMenu={(e) => handleTagContextMenu(e, tag)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>

      {/* ====== 文件夹右键菜单 ====== */}
      {contextMenuFolder && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleRenameFolder}
            className="flex w-full items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            重命名
          </button>
          <button
            type="button"
            onClick={handleDeleteFolder}
            className="flex w-full items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            删除
          </button>
        </div>
      )}

      {/* ====== 标签右键菜单 ====== */}
      {contextMenuTag && (
        <div
          ref={tagContextMenuRef}
          className="fixed z-50 min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenuTagPos.x, top: contextMenuTagPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleEditTag}
            className="flex w-full items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={handleDeleteTag}
            className="flex w-full items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            删除
          </button>
        </div>
      )}

      {/* ====== 新建文件夹弹窗 ====== */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">新建文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="输入文件夹名称"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName('');
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 重命名文件夹弹窗 ====== */}
      {showRenameFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">重命名文件夹</h3>
            <input
              type="text"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolderConfirm()}
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="输入新名称"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRenameFolder(false);
                  setRenameFolderName('');
                  setRenameFolderId(null);
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleRenameFolderConfirm}
                disabled={!renameFolderName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 新建标签弹窗 ====== */}
      {showNewTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">新建标签</h3>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="输入标签名称"
            />
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500">选择颜色</p>
              <ColorPicker color={newTagColor} onChange={setNewTagColor} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewTag(false);
                  setNewTagName('');
                  setNewTagColor(PRESET_COLORS[0]);
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 编辑标签弹窗 ====== */}
      {showEditTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">编辑标签</h3>
            <input
              type="text"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditTagConfirm()}
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="输入标签名称"
            />
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-500">选择颜色</p>
              <ColorPicker color={editTagColor} onChange={setEditTagColor} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditTag(false);
                  setEditTagName('');
                  setEditTagColor('');
                  setEditTagId(null);
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleEditTagConfirm}
                disabled={!editTagName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
