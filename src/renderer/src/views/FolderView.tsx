import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { markdownUrlTransform } from '../markdown/urlTransform';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  ChevronRight,
  FolderOpen,
  Plus,
  FileText,
  Globe,
  BookOpen,
  StickyNote,
  Briefcase,
  Pin,
} from 'lucide-react';
import dayjs from 'dayjs';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  children?: Folder[];
}

interface Item {
  id: number;
  title: string;
  summary: string;
  content_type: string;
  is_favorite: boolean;
  is_pinned: boolean;
  created_at: string;
}

interface BreadcrumbItem {
  id: number;
  name: string;
}

/* 二进制文件扩展名集合 */
const BINARY_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
  '.mp3', '.wav', '.flac',
  '.mp4', '.avi', '.mkv', '.mov',
  '.exe', '.msi', '.iso',
]);

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

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */
const FolderView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const folderId = Number(id);

  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [subFolders, setSubFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /* 预览状态 */
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<any>(null);

  /* 创建文件夹弹窗 */
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  /* 批量选择状态 */
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  /* 移动到文件夹状态 */
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<number | null>(null);
  const [moveFolders, setMoveFolders] = useState<any[]>([]);
  const [moveItemId, setMoveItemId] = useState<number | null>(null);

  /* 新建文件下拉 */
  const [showNewFileMenu, setShowNewFileMenu] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreateFile = useCallback(async (type: 'note' | 'md' | 'docx' | 'xlsx') => {
    setCreating(true);
    setShowNewFileMenu(false);
    try {
      let itemId: number;
      const folderIdNum = Number(folderId);
      if (type === 'note') {
        itemId = await window.api.item.create({
          title: '未命名笔记',
          contentType: 'note',
          sourceType: 'manual',
          folderId: folderIdNum,
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
          folderId: folderIdNum,
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
          folderId: folderIdNum,
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
          folderId: folderIdNum,
        });
      }
      navigate(`/item/${itemId}?edit=true`);
    } catch (err: any) {
      alert('创建失败: ' + (err?.message ?? '未知错误'));
    } finally {
      setCreating(false);
    }
  }, [folderId, navigate]);

  /* 加载文件夹列表（用于移动弹窗） */
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
      setMoveFolders(flatFolders);
    } catch {}
  };

  /* 加载文件夹数据 */
  const loadFolderData = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const folder = await window.api.folder.getById(folderId);
      setCurrentFolder(folder);

      // 构建面包屑
      const path: BreadcrumbItem[] = [];
      let current: Folder | null = folder;
      while (current) {
        path.unshift({ id: current.id, name: current.name });
        if (current.parent_id) {
          current = await window.api.folder.getById(current.parent_id);
        } else {
          current = null;
        }
      }
      setBreadcrumbs(path);

      // 获取子文件夹
      const tree = await window.api.folder.getTree();
      const findChildren = (nodes: Folder[]): Folder[] => {
        for (const node of nodes) {
          if (node.id === folderId) {
            return node.children ?? [];
          }
          if (node.children) {
            const found = findChildren(node.children);
            if (found.length > 0) return found;
          }
        }
        return [];
      };
      setSubFolders(findChildren(tree ?? []));

      // 获取文件夹内的条目
      const res = await window.api.item.getList({ folderId: folderId });
      setItems(res?.data ?? res?.items ?? res ?? []);
    } catch (err: any) {
      setError(err?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    loadFolderData();
  }, [loadFolderData, location.key]);

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

  useEffect(() => {
    const handleItemCreated = () => {
      loadFolderData();
    };

    window.api.on('item-created', handleItemCreated);
    return () => {
      window.api.off('item-created', handleItemCreated);
    };
  }, [loadFolderData]);

  /* 创建子文件夹 */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await window.api.folder.create({
        name: newFolderName.trim(),
        parent_id: folderId,
      });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolderData();
    } catch (err: any) {
      alert('创建文件夹失败: ' + (err?.message ?? '未知错误'));
    }
  };

  /* 创建新条目 */
  const handleCreateItem = async () => {
    try {
      const newItem = await window.api.item.create({
        title: '新建条目',
        content: '',
        folderId: folderId,
        contentType: 'note',
      });
      navigate(`/item/${newItem.id}`);
    } catch (err: any) {
      alert('创建条目失败: ' + (err?.message ?? '未知错误'));
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const dragFiles: Array<{
      name: string;
      content?: string;
      arrayBuffer?: number[];
      type: string;
      isBinary: boolean;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isBinary = BINARY_EXTENSIONS.has(ext);

      if (isBinary) {
        const buffer = await file.arrayBuffer();
        dragFiles.push({
          name: file.name,
          arrayBuffer: Array.from(new Uint8Array(buffer)),
          type: file.type || ext,
          isBinary: true,
        });
      } else {
        const content = await file.text();
        dragFiles.push({
          name: file.name,
          content,
          type: file.type || ext,
          isBinary: false,
        });
      }
    }

    try {
      await window.api.fileImport.importByDrag(dragFiles, folderId);
      loadFolderData();
    } catch (err) {
      console.error('拖拽导入失败:', err);
    }
  };

  /* 加载中 */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  /* 错误 */
  if (error || !currentFolder) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
        {error ?? '文件夹不存在'}
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 面包屑导航 */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-700">
          根目录
        </Link>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            {idx === breadcrumbs.length - 1 ? (
              <span className="font-medium text-gray-800">{crumb.name}</span>
            ) : (
              <Link
                to={`/folder/${crumb.id}`}
                className="hover:text-gray-700"
              >
                {crumb.name}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* 标题和操作 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800">{currentFolder.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            新建文件夹
          </button>
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
                  const allIds = new Set(items.map((item: any) => item.id));
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
                        loadFolderData();
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
      </div>

      {/* 子文件夹 */}
      {subFolders.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-400">子文件夹</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {subFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => navigate(`/folder/${folder.id}`)}
                className="group cursor-pointer rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-blue-400" />
                  <span className="truncate text-sm font-medium text-gray-700 group-hover:text-blue-600">
                    {folder.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件夹内的条目 */}
      <div className="flex gap-4">
        {/* 左侧列表 */}
        <div className={`${selectedItemId ? 'w-1/2' : 'w-full'} transition-all`}>
          <h2 className="mb-3 text-sm font-semibold text-gray-400">
            条目 ({items.length})
          </h2>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="mb-3 h-10 w-10" />
              <p className="text-sm">此文件夹暂无条目</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
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
                    className={`group cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md ${selectedIds.has(item.id) ? 'ring-2 ring-blue-500' : ''} ${selectedItemId === item.id ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-100'}`}
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
                        <div className="mb-1 flex items-center gap-2">
                          {!!item.is_pinned && (
                            <Pin className="h-3.5 w-3.5 flex-shrink-0 fill-blue-500 text-blue-500 rotate-45" />
                          )}
                          <h3 className="truncate text-sm font-medium text-gray-800 group-hover:text-blue-600">
                            {item.title}
                          </h3>
                          <span
                            className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.color}`}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {typeCfg.label}
                          </span>
                        </div>
                        {item.summary && (
                          <p className="text-xs text-gray-500 line-clamp-2">{item.summary}</p>
                        )}
                        <span className="mt-1 block text-xs text-gray-400">
                          {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(e, item.id)}
                        className="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-gray-100"
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧预览面板 */}
        {selectedItemId && (
          <div className="w-1/2 flex-shrink-0 rounded-lg border border-gray-100 bg-white p-6 shadow-sm overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {previewItem ? (
              <div>
                {/* 预览标题 */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">{previewItem.title}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/item/${previewItem.id}`)}
                      className="rounded-md px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      查看详情
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(null)}
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 预览内容 - 图片类型 */}
                {previewItem.content_type === 'image' && previewItem.file_path && (
                  <div className="flex justify-center">
                    <img src={`file://${previewItem.file_path}`} alt={previewItem.title} className="max-h-[400px] max-w-full rounded-lg object-contain" />
                  </div>
                )}

                {/* 预览内容 - PDF */}
                {previewItem.content_type === 'file' && previewItem.mime_type === 'application/pdf' && previewItem.file_path && (
                  <iframe src={`file://${previewItem.file_path}`} className="h-[500px] w-full rounded-lg" title={previewItem.title} />
                )}

                {/* 预览内容 - 不支持预览的文件类型 */}
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

                {/* 预览内容 - Markdown / 文本 */}
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

                {/* 无内容提示 */}
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
              {moveFolders.map((folder) => (
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
                      loadFolderData();
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

      {/* 新建文件夹弹窗 */}
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
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/90 px-16 py-12 text-center shadow-lg">
            <div className="mb-3 text-4xl">📁</div>
            <p className="text-lg font-medium text-blue-700">释放以导入文件到当前文件夹</p>
            <p className="mt-1 text-sm text-blue-500">支持拖入多个文件</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderView;
