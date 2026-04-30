import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { markdownUrlTransform } from '../markdown/urlTransform';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import TipTapEditor from '../components/editor/TipTapEditor';
import MarkdownEditor, { type MarkdownEditorHandle } from '../components/editor/MarkdownEditor';
import OutlinePanel from '../components/editor/OutlinePanel';
import WordPreview from '../components/preview/WordPreview';
import ExcelPreview from '../components/preview/ExcelPreview';
import BacklinksPanel from '../components/detail/BacklinksPanel';
import RevisionPanel from '../components/detail/RevisionPanel';
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Trash2,
  Star,
  ExternalLink,
  FolderOpen,
  Tag,
  Calendar,
  FileText,
  Download,
  Pin,
  Globe,
} from 'lucide-react';
import dayjs from 'dayjs';

interface Item {
  id: number;
  title: string;
  content: string;
  summary: string;
  content_type: string;
  source_url: string | null;
  source_name: string | null;
  file_path: string | null;
  folder_id: number | null;
  is_favorite: boolean;
  is_pinned: boolean;
  mime_type: string | null;
  content_html: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  folder_path?: string;
  tags?: TagItem[];
}

interface TagItem {
  id: number;
  name: string;
  color: string;
}

interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
  children?: FolderItem[];
}

const ItemDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemId = Number(id);

  const autoEdit = searchParams.get('edit') === 'true';

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFolderId, setEditFolderId] = useState<number | null>(null);
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mdViewMode, setMdViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [editorWidthMode, setEditorWidthMode] = useState<'narrow' | 'wide' | 'full'>('narrow');
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [htmlEditorContent, setHtmlEditorContent] = useState('');
  const [showEmbeddedBrowser, setShowEmbeddedBrowser] = useState(false);

  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [folderTree, setFolderTree] = useState<FolderItem[]>([]);
  const mdEditorRef = React.useRef<MarkdownEditorHandle>(null);

  const loadItem = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await window.api.item.getById(itemId);
      if (!data) {
        setError('条目不存在');
        return;
      }
      setItem(data);
      setEditTitle(data.title);
      const isMd = data.mime_type === 'text/markdown' || (data.source_name && data.source_name.endsWith('.md'));
      setEditContent(isMd ? (data.content || '') : (data.content_html || data.content || ''));
      setEditFolderId(data.folder_id);
      setEditTagIds(data.tags?.map((t: TagItem) => t.id) ?? []);
    } catch (err: any) {
      setError(err?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const loadMetadata = useCallback(async () => {
    try {
      const [tags, tree] = await Promise.all([
        window.api.tag.getAll(),
        window.api.folder.getTree(),
      ]);
      setAllTags(tags ?? []);
      setFolderTree(tree ?? []);
    } catch (err) {
      console.error('加载元数据失败:', err);
    }
  }, []);

  useEffect(() => {
    loadItem();
    loadMetadata();
  }, [loadItem, loadMetadata]);

  useEffect(() => {
    if (autoEdit && item && !editing) {
      setEditing(true);
    }
  }, [autoEdit, item]);

  const handleToggleFavorite = async () => {
    if (!item) return;
    try {
      await window.api.item.toggleFavorite(item.id);
      setItem({ ...item, is_favorite: !item.is_favorite });
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  const handleTogglePin = async () => {
    if (!item) return;
    try {
      await window.api.item.togglePin(item.id);
      setItem({ ...item, is_pinned: !item.is_pinned });
    } catch (err) {
      console.error('切换置顶失败:', err);
    }
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updateData: any = {
        title: editTitle,
        folderId: editFolderId,
      };

      if (isMarkdownFile) {
        updateData.content = editContent;
      } else {
        updateData.content = editContent;
        updateData.contentHtml = editContent;
      }

      const updated = await window.api.item.update(item.id, updateData);
      await window.api.tag.setForItem(item.id, editTagIds);

      if (isMarkdownFile && item.file_path) {
        try {
          await window.api.file.writeFileContent(item.file_path, editContent);
        } catch (err) {
          console.error('同步文件内容失败:', err);
        }
      }

      setItem({ ...item, ...updated, tags: allTags.filter((t) => editTagIds.includes(t.id)) });
      setEditing(false);
    } catch (err: any) {
      alert('保存失败: ' + (err?.message ?? '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!item) return;
    setEditTitle(item.title);
    const isMd = item.mime_type === 'text/markdown' || (item.source_name && item.source_name.endsWith('.md'));
    setEditContent(isMd ? (item.content || '') : (item.content_html || item.content || ''));
    setEditFolderId(item.folder_id);
    setEditTagIds(item.tags?.map((t) => t.id) ?? []);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!item) return;
    try {
      await window.api.item.delete(item.id);
      navigate(-1);
    } catch (err: any) {
      alert('删除失败: ' + (err?.message ?? '未知错误'));
    }
  };

  const handlePermanentDelete = async () => {
    if (!item) return;
    try {
      await window.api.item.permanentDelete(item.id);
      navigate(-1);
    } catch (err: any) {
      alert('永久删除失败: ' + (err?.message ?? '未知错误'));
    }
  };

  const handleRestore = async () => {
    if (!item) return;
    try {
      await window.api.item.restore(item.id);
      setItem({ ...item, deleted_at: null });
    } catch (err: any) {
      alert('恢复失败: ' + (err?.message ?? '未知错误'));
    }
  };

  const handleExport = async (format: 'markdown' | 'json') => {
    if (!item) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const result =
        format === 'markdown'
          ? await window.api.item.exportMarkdown(item.id)
          : await window.api.item.exportJSON(item.id);
      if (result?.success === false) {
        alert('导出失败: ' + (result.error ?? '未知错误'));
      }
    } catch (err: any) {
      alert('导出失败: ' + (err?.message ?? '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const flattenFolders = (nodes: FolderItem[], prefix = ''): { id: number; label: string }[] => {
    const result: { id: number; label: string }[] = [];
    nodes.forEach((node) => {
      result.push({ id: node.id, label: prefix + node.name });
      if (node.children) {
        result.push(...flattenFolders(node.children, prefix + '  '));
      }
    });
    return result;
  };

  const flatFolders = flattenFolders(folderTree);

  const isNoteType = item && (item.content_type === 'note' || item.content_type === 'article' || item.content_type === 'bookmark');
  const isMarkdownFile = item && (
    item.mime_type === 'text/markdown' ||
    (item.source_name && item.source_name.endsWith('.md'))
  );
  const isInTrash = item && item.deleted_at;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="py-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error ?? '条目不存在'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>

        <div className="flex items-center gap-2">
          {isInTrash && (
            <>
              <button
                type="button"
                onClick={handleRestore}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                恢复
              </button>
              <button
                type="button"
                onClick={() => setShowPermanentDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                永久删除
              </button>
            </>
          )}

          {!editing && !isInTrash && (
            <>
              <button
                type="button"
                onClick={handleTogglePin}
                className="rounded-md p-2 transition-colors hover:bg-gray-100"
                title={item.is_pinned ? '取消置顶' : '置顶'}
              >
                <Pin
                  className={`h-4 w-4 ${
                    item.is_pinned
                      ? 'fill-blue-500 text-blue-500 rotate-45'
                      : 'text-gray-400'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={handleToggleFavorite}
                className="rounded-md p-2 transition-colors hover:bg-gray-100"
                title={item.is_favorite ? '取消收藏' : '收藏'}
              >
                <Star
                  className={`h-4 w-4 ${
                    item.is_favorite
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-400'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Edit3 className="h-4 w-4" />
                编辑
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  <Download className="h-4 w-4" />
                  导出
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExport('markdown')}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('json')}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      JSON
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </>
          )}

          {editing && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">标题</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="输入标题"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <FolderOpen className="mr-1 inline h-4 w-4" />
              文件夹
            </label>
            <select
              value={editFolderId ?? ''}
              onChange={(e) =>
                setEditFolderId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">无文件夹</option>
              {flatFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Tag className="mr-1 inline h-4 w-4" />
              标签
            </label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const selected = editTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'ring-2 ring-offset-1'
                        : 'opacity-50 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      outline: selected ? `2px solid ${tag.color}` : undefined,
                    }}
                  >
                    {selected && '✓ '}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">内容</label>
            {isMarkdownFile ? (
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <MarkdownEditor
                    ref={mdEditorRef}
                    content={editContent}
                    onChange={(value) => setEditContent(value)}
                    viewMode={mdViewMode}
                    onViewModeChange={setMdViewMode}
                    placeholder="输入 Markdown 内容..."
                    itemId={itemId}
                  />
                </div>
                <div className="w-56 flex-shrink-0">
                  <OutlinePanel
                    content={editContent}
                    onJumpToLine={(line) => mdEditorRef.current?.scrollToLine(line)}
                  />
                </div>
              </div>
            ) : (
              <TipTapEditor
                content={editContent}
                onChange={(html) => setEditContent(html)}
                placeholder="开始输入内容..."
                itemId={itemId}
                widthMode={editorWidthMode}
                onWidthModeChange={setEditorWidthMode}
                onHtmlEdit={(html) => { setHtmlEditorContent(html); setShowHtmlEditor(true); }}
              />
            )}
          </div>
        </div>
      )}

      {!editing && (
        <div>
          <h1 className="mb-4 text-2xl font-bold text-gray-800">
            {isInTrash && <span className="mr-2 text-sm font-normal text-red-500">[已删除]</span>}
            {!!item.is_pinned && <Pin className="mr-1.5 inline h-5 w-5 fill-blue-500 text-blue-500 rotate-45" />}
            {item.title}
          </h1>

          <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-400">
            {item.folder_path && (
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                {item.folder_path}
              </span>
            )}
            {item.tags && item.tags.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {item.tags.map((tag) => (
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
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              创建于 {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
            </span>
            {item.updated_at !== item.created_at && (
              <span>
                更新于 {dayjs(item.updated_at).format('YYYY-MM-DD HH:mm')}
              </span>
            )}
          </div>

          {item.source_url && (
            <div className="mb-6 flex items-center gap-3">
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
                {item.source_url}
              </a>
              <button
                type="button"
                onClick={() => setShowEmbeddedBrowser(!showEmbeddedBrowser)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  showEmbeddedBrowser
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Globe className="h-4 w-4" />
                {showEmbeddedBrowser ? '关闭浏览器' : '浏览原文'}
              </button>
            </div>
          )}

          {item.content_type === 'image' && item.file_path && (
            <div className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center">
                <img
                  src={`local-image:///${item.file_path}`}
                  alt={item.title}
                  className="max-h-[600px] max-w-full rounded-lg object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <p className="mt-4 hidden text-sm text-gray-500">图片无法预览，请尝试用外部程序打开</p>
                <button
                  type="button"
                  onClick={() => window.api.file.openFile(item.file_path!)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  打开图片
                </button>
              </div>
            </div>
          )}

          {item.content_type === 'file' && item.mime_type === 'application/pdf' && item.file_path && (
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <iframe
                src={`file://${item.file_path}`}
                className="h-[700px] w-full rounded-lg"
                title={item.title}
              />
              <div className="flex justify-center p-3">
                <button
                  type="button"
                  onClick={() => window.api.file.openFile(item.file_path!)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  用外部程序打开
                </button>
              </div>
            </div>
          )}

          {item.content_type === 'file' && item.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && item.file_path && (
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <WordPreview
                filePath={item.file_path}
                onOpenExternal={() => window.api.file.openFile(item.file_path!)}
              />
              <div className="flex justify-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => window.api.file.openFile(item.file_path!)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  用 Office 编辑
                </button>
              </div>
            </div>
          )}

          {item.content_type === 'file' && item.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && item.file_path && (
            <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
              <ExcelPreview
                filePath={item.file_path}
                onOpenExternal={() => window.api.file.openFile(item.file_path!)}
              />
              <div className="flex justify-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => window.api.file.openFile(item.file_path!)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  用 Office 编辑
                </button>
              </div>
            </div>
          )}

          {item.content_type === 'file' && item.mime_type && item.mime_type.startsWith('application/') && item.mime_type !== 'application/pdf' && item.mime_type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && item.mime_type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !item.content && (
            <div className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center text-center text-gray-500">
                <FileText className="mb-4 h-12 w-12" />
                <p className="mb-2 text-lg font-medium">{item.title}</p>
                <p className="mb-4 text-sm">此文件类型不支持内联预览</p>
                {item.file_path && (
                  <button
                    type="button"
                    onClick={() => window.api.file.openFile(item.file_path)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    打开文件
                  </button>
                )}
              </div>
            </div>
          )}

          {isMarkdownFile && item.content && (
            <div className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                urlTransform={markdownUrlTransform}
              >
                {item.content}
              </ReactMarkdown>
            </div>
          )}

          {isMarkdownFile && !item.content && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="mb-3 h-12 w-12" />
              <p className="text-lg">空白文档</p>
              <p className="mt-1 text-sm">点击"编辑"开始输入内容</p>
            </div>
          )}

          {!isMarkdownFile && item.content_html && !item.content_type?.includes('file') && isNoteType && (
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <TipTapEditor
                content={item.content_html}
                readOnly
              />
            </div>
          )}

          {!isMarkdownFile && item.content_html && !item.content_type?.includes('file') && !isNoteType && (
            <div className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div dangerouslySetInnerHTML={{ __html: item.content_html }} />
            </div>
          )}

          {!isMarkdownFile && item.content && !item.content_html && item.content_type !== 'image' && !(item.content_type === 'file' && !item.content) && (
            <div className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                urlTransform={markdownUrlTransform}
              >
                {item.content}
              </ReactMarkdown>
            </div>
          )}

          {showEmbeddedBrowser && item.source_url && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                <span className="text-sm text-gray-600 truncate max-w-[80%]">{item.source_url}</span>
                <button
                  type="button"
                  onClick={() => setShowEmbeddedBrowser(false)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <webview
                src={item.source_url}
                className="h-[600px] w-full"
                partition="persist:webview"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                allowpopups="true"
              />
            </div>
          )}

          <RevisionPanel itemId={item.id} onRestored={loadItem} />
          <BacklinksPanel itemId={item.id} />
        </div>
      )}

      {showHtmlEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 flex max-h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">HTML 源码编辑</h3>
              <button
                type="button"
                onClick={() => setShowHtmlEditor(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={htmlEditorContent}
                onChange={(e) => setHtmlEditorContent(e.target.value)}
                className="h-[50vh] w-full rounded-lg border border-gray-300 p-4 font-mono text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="HTML 源码..."
              />
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setShowHtmlEditor(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditContent(htmlEditorContent);
                  setShowHtmlEditor(false);
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                应用
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-800">确认删除</h3>
            <p className="mb-6 text-sm text-gray-500">
              确定要删除「{item.title}」吗？条目将移入回收站，可从回收站恢复。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermanentDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-800">永久删除</h3>
            <p className="mb-6 text-sm text-gray-500">
              确定要永久删除「{item.title}」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPermanentDeleteConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                永久删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemDetailView;
