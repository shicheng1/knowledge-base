import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, FileText, Globe, BookOpen, StickyNote, Briefcase, Plus, Pin, Archive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { markdownUrlTransform } from '../markdown/urlTransform';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
interface Item {
  id: number;
  title: string;
  summary: string;
  content_type: string;
  source_url: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface HomeViewProps {
  favoriteOnly?: boolean;
}

/* 内容类型配置 */
const CONTENT_TYPE_MAP: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  note: { label: '笔记', color: 'bg-yellow-100 text-yellow-700', icon: StickyNote },
  article: { label: '文章', color: 'bg-purple-100 text-purple-700', icon: BookOpen },
  bookmark: { label: '书签', color: 'bg-blue-100 text-blue-700', icon: Globe },
  file: { label: '文件', color: 'bg-green-100 text-green-700', icon: FileText },
  code: { label: '代码', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  image: { label: '图片', color: 'bg-pink-100 text-pink-700', icon: FileText },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700', icon: Briefcase },
};

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_MAP);

/* 二进制文件扩展名集合 */
const BINARY_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
  '.mp3', '.wav', '.flac',
  '.mp4', '.avi', '.mkv', '.mov',
  '.exe', '.msi', '.iso',
]);

/* ------------------------------------------------------------------ */
/*  日期分组工具                                                       */
/* ------------------------------------------------------------------ */
type DateGroup = { key: string; label: string; items: Item[] };

function groupByDate(items: Item[]): DateGroup[] {
  const now = dayjs();
  const todayStart = now.startOf('day');
  const yesterdayStart = todayStart.subtract(1, 'day');
  const weekStart = now.startOf('week');

  const groups: Record<string, { label: string; items: Item[] }> = {
    today: { label: '今天', items: [] },
    yesterday: { label: '昨天', items: [] },
    thisWeek: { label: '本周', items: [] },
    earlier: { label: '更早', items: [] },
  };

  items.forEach((item) => {
    const itemDate = dayjs(item.created_at);
    if (itemDate.isAfter(todayStart)) {
      groups.today.items.push(item);
    } else if (itemDate.isAfter(yesterdayStart)) {
      groups.yesterday.items.push(item);
    } else if (itemDate.isAfter(weekStart)) {
      groups.thisWeek.items.push(item);
    } else {
      groups.earlier.items.push(item);
    }
  });

  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([key, g]) => ({ key, label: g.label, items: g.items }));
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */
const HomeView: React.FC<HomeViewProps> = ({ favoriteOnly = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /* 预览状态 */
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);

  /* 新建文件夹弹窗 */
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  /* 新建文件下拉 */
  const [showNewFileMenu, setShowNewFileMenu] = useState(false);
  const [creating, setCreating] = useState(false);

  /* 筛选状态 */
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');

  /* 批量选择状态 */
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  /* 移动到文件夹状态 */
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [moveItemId, setMoveItemId] = useState<number | null>(null);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveUrl, setArchiveUrl] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);

  const handleCreateFile = useCallback(async (type: 'note' | 'md' | 'docx' | 'xlsx') => {
    setCreating(true);
    setShowNewFileMenu(false);
    try {
      let itemId: number;
      if (type === 'note') {
        itemId = await window.api.item.create({
          title: '未命名笔记',
          contentType: 'note',
          sourceType: 'manual',
          mimeType: 'text/markdown',
        });
      } else if (type === 'md') {
        const filePath = await window.api.file.createEmptyMd();
        const fileName = filePath.split(/[/\\]/).pop() ?? '未命名.md';
        itemId = await window.api.item.create({
          title: '未命名文件',
          contentType: 'note',
          sourceType: 'manual',
          sourceName: fileName,
          filePath,
          mimeType: 'text/markdown',
        });
      } else if (type === 'docx') {
        const filePath = await window.api.file.createEmptyDocx();
        const fileName = filePath.split(/[/\\]/).pop() ?? '未命名.docx';
        itemId = await window.api.item.create({
          title: '未命名文档',
          contentType: 'file',
          sourceType: 'manual',
          sourceName: fileName,
          filePath,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      } else {
        const filePath = await window.api.file.createEmptyXlsx();
        const fileName = filePath.split(/[/\\]/).pop() ?? '未命名.xlsx';
        itemId = await window.api.item.create({
          title: '未命名表格',
          contentType: 'file',
          sourceType: 'manual',
          sourceName: fileName,
          filePath,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }
      navigate(`/item/${itemId}?edit=true`);
    } catch (err: any) {
      alert('创建失败: ' + (err?.message ?? '未知错误'));
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  /* 加载条目列表 */
  const loadItems = useCallback(async () => {
    try {
      const options: any = {};
      if (favoriteOnly) {
        options.isFavorite = true;
      }
      if (contentTypeFilter !== 'all') {
        options.contentType = contentTypeFilter;
      }
      const res = await window.api.item.getList(options);
      setItems(res?.data ?? res?.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? '加载失败');
    }
  }, [favoriteOnly, contentTypeFilter]);

  /* 加载文件夹列表 */
  const loadFolders = async () => {
    try {
      const tree = await window.api.folder.getTree();
      const flatFolders: any[] = [];
      const flatten = (nodes: any[], depth = 0) => {
        for (const node of nodes) {
          flatFolders.push({ id: node.id, name: node.name, depth });
          if (node.children) flatten(node.children, depth + 1);
        }
      };
      flatten(tree);
      setFolders(flatFolders);
    } catch {}
  };

  /* 加载数据 */
  useEffect(() => {
    setLoading(true);
    setError(null);
    loadItems().finally(() => setLoading(false));
  }, [loadItems, location.key]);

  useEffect(() => {
    const handleItemCreated = () => {
      loadItems();
    };

    window.api.on('item-created', handleItemCreated);
    return () => {
      window.api.off('item-created', handleItemCreated);
    };
  }, [loadItems]);

  /* 日期分组 */
  const grouped = useMemo(() => groupByDate(items), [items]);

  /* 切换收藏 */
  const handleToggleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await window.api.item.toggleFavorite(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_favorite: !item.is_favorite } : item,
        ),
      );
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await window.api.item.togglePin(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_pinned: !item.is_pinned } : item,
        ),
      );
    } catch (err) {
      console.error('切换置顶失败:', err);
    }
  };

  /* 加载预览数据 */
  const loadPreviewItem = useCallback(async (itemId: number) => {
    try {
      const data = await window.api.item.getById(itemId);
      setPreviewItem(data);
    } catch (err) {
      console.error('加载预览数据失败:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      loadPreviewItem(selectedItemId);
    } else {
      setPreviewItem(null);
    }
  }, [selectedItemId, loadPreviewItem]);

  /* 创建文件夹 */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await window.api.folder.create({ name: newFolderName.trim(), parent_id: null });
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (err: any) {
      alert('创建文件夹失败: ' + (err?.message ?? '未知错误'));
    }
  };

  /* 截断文本 */
  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + '...' : text;

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDropEvent = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    try {
      const fileEntries = await Promise.all(
        Array.from(files).map(async (file) => {
          const ext = '.' + file.name.split('.').pop()?.toLowerCase();
          const isBinary = BINARY_EXTENSIONS.has(ext);

          if (isBinary) {
            const buffer = await file.arrayBuffer();
            return {
              name: file.name,
              arrayBuffer: Array.from(new Uint8Array(buffer)),
              type: file.type || ext,
              isBinary: true,
            };
          } else {
            const content = await file.text();
            return {
              name: file.name,
              content,
              type: file.type || ext,
              isBinary: false,
            };
          }
        }),
      );

      await window.api.fileImport.importByDrag(fileEntries, null);

      // 导入成功后刷新列表
      const options: any = {};
      if (favoriteOnly) options.isFavorite = true;
      if (contentTypeFilter !== 'all') options.contentType = contentTypeFilter;
      const res = await window.api.item.getList(options);
      setItems(res?.data ?? res?.items ?? []);
    } catch (err) {
      console.error('拖拽导入失败:', err);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
    >
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          {favoriteOnly ? '收藏夹' : '全部条目'}
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewFolder(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              新建文件夹
            </button>
            {!favoriteOnly && (
              <button
                type="button"
                onClick={() => {
                  setArchiveUrl('');
                  setShowArchiveModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
              >
                <Archive className="h-4 w-4" />
                完整网页存档
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNewFileMenu(!showNewFileMenu)}
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                新建
              </button>
              {showNewFileMenu && (
                <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleCreateFile('note')}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    📝 Markdown 笔记
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateFile('md')}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    📄 Markdown 文件
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateFile('docx')}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    📑 Word 文档
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateFile('xlsx')}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    📊 Excel 表格
                  </button>
                </div>
              )}
            </div>
            {!isSelectMode ? (
              <button
                type="button"
                onClick={() => setIsSelectMode(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                选择
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = new Set(grouped.flatMap((g) => g.items.map((item: any) => item.id)));
                    setSelectedIds(allIds);
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedIds(new Set()); setIsSelectMode(false); }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await window.api.item.batchExport(Array.from(selectedIds));
                        } catch (err: any) {
                          alert('导出失败: ' + (err?.message ?? '未知错误'));
                        }
                      }}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                    >
                      导出选中 ({selectedIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`确定删除选中的 ${selectedIds.size} 个条目吗？`)) return;
                        try {
                          await window.api.item.batchDelete(Array.from(selectedIds));
                          setSelectedIds(new Set());
                          setIsSelectMode(false);
                          loadItems();
                        } catch (err: any) {
                          alert('删除失败: ' + (err?.message ?? '未知错误'));
                        }
                      }}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                    >
                      删除选中 ({selectedIds.size})
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <span className="text-sm text-gray-400">
            共 {items.length} 条记录
          </span>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-500">类型筛选:</span>
        <button
          type="button"
          onClick={() => setContentTypeFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            contentTypeFilter === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部
        </button>
        {CONTENT_TYPES.map((type) => {
          const cfg = CONTENT_TYPE_MAP[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => setContentTypeFilter(type)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                contentTypeFilter === type
                  ? 'bg-gray-800 text-white'
                  : `${cfg.color} hover:opacity-80`
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        {/* 左侧列表 */}
        <div className={`${selectedItemId ? 'w-1/2' : 'w-full'} transition-all`}>
          {/* 加载状态 */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 空状态 */}
          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText className="mb-3 h-12 w-12" />
              <p className="text-lg">暂无条目</p>
              <p className="mt-1 text-sm">开始添加你的知识条目吧</p>
            </div>
          )}

          {/* 按日期分组显示 */}
          {!loading &&
            !error &&
            grouped.map((group) => (
              <div key={group.key} className="mb-8">
                <h2 className="mb-3 text-sm font-semibold text-gray-400">{group.label}</h2>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const typeCfg = CONTENT_TYPE_MAP[item.content_type] ?? {
                      label: item.content_type,
                      color: 'bg-gray-100 text-gray-600',
                      icon: FileText,
                    };
                    const TypeIcon = typeCfg.icon;

                    return (
                      <div
                        key={item.id}
                        onClick={() => { if (!isSelectMode) setSelectedItemId(item.id); }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMoveItemId(item.id);
                          setMoveTargetFolderId(null);
                          loadFolders();
                          setShowMoveDialog(true);
                        }}
                        className={`group cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md ${
                          selectedIds.has(item.id) ? 'ring-2 ring-blue-500' : ''
                        } ${
                          selectedItemId === item.id ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {/* 选择模式复选框 */}
                            {isSelectMode && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(selectedIds);
                                  if (newSet.has(item.id)) newSet.delete(item.id);
                                  else newSet.add(item.id);
                                  setSelectedIds(newSet);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            )}
                            {/* 标题行 */}
                            <div className="mb-1 flex items-center gap-2">
                              {!!item.is_pinned && (
                                <Pin className="h-3.5 w-3.5 flex-shrink-0 fill-blue-500 text-blue-500 rotate-45" />
                              )}
                              <h3 className="truncate text-base font-medium text-gray-800 group-hover:text-blue-600">
                                {item.title}
                              </h3>
                              <span
                                className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.color}`}
                              >
                                <TypeIcon className="h-3 w-3" />
                                {typeCfg.label}
                              </span>
                            </div>

                            {/* 摘要 */}
                            {item.summary && (
                              <p className="mb-2 text-sm leading-relaxed text-gray-500">
                                {truncate(item.summary, 120)}
                              </p>
                            )}

                            {/* 元信息 */}
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{dayjs(item.created_at).format('HH:mm')}</span>
                              {item.source_url && (
                                <span className="truncate max-w-[200px]">
                                  来源: {truncate(item.source_url, 40)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 收藏按钮 */}
                          <div className="flex flex-shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleTogglePin(e, item.id)}
                              className="rounded-md p-1 transition-colors hover:bg-gray-100"
                              title={item.is_pinned ? '取消置顶' : '置顶'}
                            >
                              <Pin
                                className={`h-4 w-4 ${
                                  item.is_pinned
                                    ? 'fill-blue-500 text-blue-500 rotate-45'
                                    : 'text-gray-300'
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(e, item.id)}
                              className="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-gray-100"
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  item.is_favorite
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        {/* 右侧预览面板 */}
        {selectedItemId && (
          <div className="w-1/2 flex-shrink-0 rounded-lg border border-gray-100 bg-white p-6 shadow-sm overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {previewItem ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-gray-800">{previewItem.title}</h2>
                    {previewItem.tags && previewItem.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {previewItem.tags.map((tag: any) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button type="button" onClick={() => navigate(`/item/${previewItem.id}`)} className="rounded-md px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">
                      查看详情
                    </button>
                    <button type="button" onClick={() => setSelectedItemId(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
                      ✕
                    </button>
                  </div>
                </div>

                {/* 图片预览 */}
                {previewItem.content_type === 'image' && previewItem.file_path && (
                  <div className="flex justify-center">
                    <img src={`file://${previewItem.file_path}`} alt={previewItem.title} className="max-h-[400px] max-w-full rounded-lg object-contain" />
                  </div>
                )}

                {/* PDF 预览 */}
                {previewItem.content_type === 'file' && previewItem.mime_type === 'application/pdf' && previewItem.file_path && (
                  <iframe src={`file://${previewItem.file_path}`} className="h-[500px] w-full rounded-lg" title={previewItem.title} />
                )}

                {/* Office 文件 */}
                {previewItem.content_type === 'file' && previewItem.mime_type?.startsWith('application/') && previewItem.mime_type !== 'application/pdf' && !previewItem.content && (
                  <div className="flex flex-col items-center py-8 text-gray-500">
                    <FileText className="mb-3 h-10 w-10" />
                    <p className="text-sm">此文件类型不支持预览</p>
                    {previewItem.file_path && (
                      <button type="button" onClick={() => window.api.file.openFile(previewItem.file_path)} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                        打开文件
                      </button>
                    )}
                  </div>
                )}

                {/* Markdown 内容 */}
                {previewItem.content && previewItem.content_type !== 'image' && !(previewItem.content_type === 'file' && !previewItem.content) && (
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      urlTransform={markdownUrlTransform}
                    >
                      {previewItem.content}
                    </ReactMarkdown>
                  </div>
                )}

                {!previewItem.content && previewItem.content_type !== 'image' && previewItem.content_type !== 'file' && (
                  <p className="text-sm text-gray-400">暂无内容</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}
          </div>
        )}
      </div>
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-800">完整网页存档</h3>
            <p className="mb-4 text-xs text-gray-500">内联 CSS 与图片，离线可读</p>
            <input
              type="url"
              value={archiveUrl}
              onChange={(e) => setArchiveUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && archiveUrl.trim() && !archiveBusy) {
                  e.preventDefault();
                  void (async () => {
                    setArchiveBusy(true);
                    try {
                      const r = await window.api.import.archiveUrl(archiveUrl.trim(), null);
                      setShowArchiveModal(false);
                      setArchiveUrl('');
                      await loadItems();
                      navigate(`/item/${r.id}`);
                    } catch (err: any) {
                      alert('存档失败: ' + (err?.message ?? '未知错误'));
                    } finally {
                      setArchiveBusy(false);
                    }
                  })();
                }
              }}
              autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="https://…"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveUrl('');
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={archiveBusy || !archiveUrl.trim()}
                onClick={async () => {
                  setArchiveBusy(true);
                  try {
                    const r = await window.api.import.archiveUrl(archiveUrl.trim(), null);
                    setShowArchiveModal(false);
                    setArchiveUrl('');
                    await loadItems();
                    navigate(`/item/${r.id}`);
                  } catch (err: any) {
                    alert('存档失败: ' + (err?.message ?? '未知错误'));
                  } finally {
                    setArchiveBusy(false);
                  }
                }}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {archiveBusy ? '存档中…' : '开始存档'}
              </button>
            </div>
          </div>
        </div>
      )}
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
              <button type="button" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                取消
              </button>
              <button type="button" onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                创建
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 移动到文件夹弹窗 */}
      {showMoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">移动到文件夹</h3>
            <div className="max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={() => setMoveTargetFolderId(null)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${moveTargetFolderId === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                根目录
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setMoveTargetFolderId(folder.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${moveTargetFolderId === folder.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                  style={{ paddingLeft: `${(folder.depth + 1) * 16 + 12}px` }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowMoveDialog(false)} className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (moveItemId) {
                    try {
                      await window.api.item.update(moveItemId, { folderId: moveTargetFolderId });
                      loadItems();
                    } catch (err: any) {
                      alert('移动失败: ' + (err?.message ?? '未知错误'));
                    }
                  }
                  setShowMoveDialog(false);
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                移动
              </button>
            </div>
          </div>
        </div>
      )}
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/90 px-16 py-12 text-center shadow-lg">
            <div className="mb-3 text-4xl">📁</div>
            <p className="text-lg font-medium text-blue-700">释放以导入文件</p>
            <p className="mt-1 text-sm text-blue-500">支持拖入多个文件</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
