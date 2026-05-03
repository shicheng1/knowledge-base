import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Rss, Github, Search, RefreshCw, Download, CheckCircle, ExternalLink, ChevronLeft, ChevronRight, FolderOpen, Languages, X, ArrowLeftRight, Trash2, ArrowUp, Star, BookOpen } from 'lucide-react';
import { feedApi, folderApi } from '../lib/api';

interface FeedItem {
  id: number;
  sourceId: number;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  contentHash: string | null;
  importedItemId: number | null;
  metadata: string | null;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
  source?: { id: number; name: string; type: string; iconUrl: string | null };
}

interface FeedSource {
  id: number;
  name: string;
  url: string;
  type: string;
  description: string | null;
  iconUrl: string | null;
  siteUrl: string | null;
  category: string | null;
  enabled: boolean;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
  failCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FlatFolder {
  id: number;
  name: string;
  depth: number;
}

const SOURCE_TYPE_TABS = [
  { key: 'all' as const, label: '全部' },
  { key: 'rss' as const, label: 'RSS' },
  { key: 'github' as const, label: 'GitHub' },
];

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  if (diff < 0) return '刚刚';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const FeedView: React.FC = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<{
    sourceType: 'all' | 'rss' | 'github';
    sourceId: number | null;
    category: string;
    keyword: string;
    starredOnly: boolean;
  }>({
    sourceType: 'all',
    sourceId: null,
    category: '',
    keyword: '',
    starredOnly: false,
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [importTargetIds, setImportTargetIds] = useState<number[]>([]);

  const [translatedItems, setTranslatedItems] = useState<Map<number, { title: string; summary: string }>>(new Map());
  const [showTranslation, setShowTranslation] = useState<Map<number, boolean>>(new Map());
  const [translating, setTranslating] = useState<Set<number>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [readingMode, setReadingMode] = useState(false);
  const [readingContent, setReadingContent] = useState<{ title: string; content: string; contentHtml: string; author: string | null; siteName: string | null } | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);

  const [viewMode, setViewMode] = useState<'items' | 'sources'>('items');
  const [sourceForm, setSourceForm] = useState({ name: '', url: '', type: 'rss', category: '' });
  const [sourceFormLoading, setSourceFormLoading] = useState(false);
  const [sourceFormMessage, setSourceFormMessage] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState('');
  const [presetSources, setPresetSources] = useState<any[]>([]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const readingContainerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const loadItems = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const res = await feedApi.getItems({
        page: p ?? page,
        pageSize: 20,
        sourceId: filter.sourceId ?? undefined,
        sourceType: filter.sourceType === 'all' ? undefined : filter.sourceType,
        keyword: filter.keyword || undefined,
        unimportedOnly: false,
        starredOnly: filter.starredOnly || undefined,
      });
      let result = res;
      if (res && typeof res === 'object' && 'success' in res) {
        if (res.success) {
          result = res.data;
        } else {
          console.error('[FeedView] getItems failed:', res.error);
          setItems([]);
          setTotal(0);
          return;
        }
      }
      setItems(Array.isArray(result?.data) ? result.data : []);
      setTotal(result?.total ?? 0);
      setPage(result?.page ?? 1);
      setTotalPages(result?.totalPages ?? 1);
    } catch (err) {
      console.error('[FeedView] loadItems error:', err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filter.sourceType, filter.sourceId, filter.keyword, filter.starredOnly]);

  const loadSources = useCallback(async () => {
    try {
      const res = await feedApi.getSources();
      let result = res;
      if (res && typeof res === 'object' && 'success' in res) {
        if (res.success) {
          result = res.data;
        } else {
          console.error('[FeedView] getSources failed:', res.error);
          setSources([]);
          return;
        }
      }
      setSources(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('[FeedView] loadSources error:', err);
      setSources([]);
    }
  }, []);

  const loadPresetSources = useCallback(async () => {
    try {
      const res = await feedApi.getPresetSources();
      let result = res;
      if (res && typeof res === 'object' && 'success' in res) {
        if (res.success) result = res.data;
      }
      setPresetSources(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('[FeedView] loadPresetSources error:', err);
      setPresetSources([]);
    }
  }, []);

  const handleAddSource = async () => {
    if (!sourceForm.name.trim() || !sourceForm.url.trim()) {
      setSourceFormMessage({ ok: false, msg: '名称和 URL 不能为空' });
      return;
    }
    setSourceFormLoading(true);
    setSourceFormMessage(null);
    try {
      await feedApi.addSource({
        name: sourceForm.name.trim(),
        url: sourceForm.url.trim(),
        type: sourceForm.type,
        category: sourceForm.category.trim() || undefined,
      });
      setSourceFormMessage({ ok: true, msg: '添加成功' });
      setSourceForm({ name: '', url: '', type: 'rss', category: '' });
      await loadSources();
    } catch (err: any) {
      setSourceFormMessage({ ok: false, msg: err?.message ?? '添加失败' });
    } finally {
      setSourceFormLoading(false);
    }
  };

  const handleToggleSource = async (sourceId: number, enabled: boolean) => {
    try {
      await feedApi.updateSource(sourceId, { enabled: !enabled });
      await loadSources();
    } catch (err) {
      console.error('[FeedView] toggleSource error:', err);
    }
  };

  const handleDeleteSource = async (sourceId: number) => {
    if (!window.confirm('确定要删除该知识源吗？')) return;
    try {
      await feedApi.deleteSource(sourceId);
      await loadSources();
      setSelectedSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    } catch (err) {
      console.error('[FeedView] deleteSource error:', err);
    }
  };

  const handleBatchDeleteSources = async () => {
    if (selectedSourceIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedSourceIds.size} 个知识源吗？`)) return;
    try {
      await feedApi.batchDeleteSources(Array.from(selectedSourceIds));
      await loadSources();
      setSelectedSourceIds(new Set());
    } catch (err) {
      console.error('[FeedView] batchDeleteSources error:', err);
    }
  };

  const toggleSourceSelect = (id: number) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportOpml = async () => {
    const input = document.getElementById('opml-file-input-2') as HTMLInputElement;
    input?.click();
  };

  const handleOpmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const data = await feedApi.importOpml(content);
      alert(`导入完成：新增 ${data?.imported ?? 0} 个，更新分类 ${data?.updated ?? 0} 个，跳过 ${data?.skipped ?? 0} 个，失败 ${data?.failed ?? 0} 个`);
      await loadSources();
    } catch (err) {
      console.error('[FeedView] OPML import error:', err);
      alert('OPML 导入失败');
    }
    e.target.value = '';
  };

  const handleAddPresetSource = async (preset: any) => {
    setSourceFormLoading(true);
    try {
      await feedApi.addSource({
        name: preset.name,
        url: preset.url,
        type: preset.type || 'rss',
        description: preset.description,
        siteUrl: preset.siteUrl,
        category: preset.category,
      });
      await loadSources();
      await loadPresetSources();
    } catch (err: any) {
      alert(err?.message ?? '添加预置源失败');
    } finally {
      setSourceFormLoading(false);
    }
  };

  const filteredSourcesByCategory = sourceCategoryFilter
    ? sources.filter((s) => (s.category || '') === sourceCategoryFilter)
    : sources;

  const uniqueCategories = Array.from(
    new Set(sources.map((s) => s.category || '').filter(Boolean)),
  );

  const categorySourceIds = filter.category
    ? new Set(sources.filter((s) => (s.category || '') === filter.category).map((s) => s.id))
    : null;

  const displayItems = categorySourceIds
    ? items.filter((item) => item.sourceId && categorySourceIds.has(item.sourceId))
    : items;

  useEffect(() => {
    loadItems(1);
  }, [filter.sourceType, filter.sourceId, filter.category, filter.keyword, filter.starredOnly]);

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (viewMode === 'sources') {
      loadPresetSources();
    }
  }, [viewMode]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await feedApi.refreshAll();
    } catch (err) {
      console.error('[FeedView] refreshAll error:', err);
    }
    try {
      await loadItems(page);
    } catch (err) {
      console.error('[FeedView] loadItems after refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearchInput = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilter((prev) => ({ ...prev, keyword: value }));
      setPage(1);
    }, 500);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      const value = (e.target as HTMLInputElement).value;
      setFilter((prev) => ({ ...prev, keyword: value }));
      setPage(1);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadItems(newPage);
    setSelectedIds(new Set());
  };

  const openFolderDialog = async (targetIds: number[]) => {
    setImportTargetIds(targetIds);
    setSelectedFolderId(null);
    try {
      const tree = await folderApi.getTree();
      const flat: FlatFolder[] = [];
      const flatten = (nodes: any[], depth = 0) => {
        for (const node of nodes) {
          flat.push({ id: node.id, name: node.name, depth });
          if (node.children) flatten(node.children, depth + 1);
        }
      };
      flatten(tree);
      setFolders(flat);
    } catch {
      setFolders([]);
    }
    setShowFolderDialog(true);
  };

  const handleImport = async () => {
    if (importTargetIds.length === 0) return;
    setImporting(true);
    try {
      if (importTargetIds.length === 1) {
        await feedApi.importItem(importTargetIds[0], selectedFolderId ?? undefined);
      } else {
        setImportProgress({ current: 0, total: importTargetIds.length });
        await feedApi.batchImport(importTargetIds, selectedFolderId ?? undefined);
        setImportProgress(null);
      }
      setShowFolderDialog(false);
      setImportTargetIds([]);
      setSelectedIds(new Set());
      await loadItems(page);
    } catch {
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTranslate = async (itemId: number) => {
    if (translatedItems.has(itemId)) {
      setShowTranslation(prev => {
        const next = new Map(prev);
        next.set(itemId, !prev.get(itemId));
        return next;
      });
      return;
    }
    setTranslating(prev => new Set(prev).add(itemId));
    try {
      const res = await feedApi.translateItem(itemId);
      let result = res;
      if (res && typeof res === 'object' && 'success' in res) {
        if (res.success) {
          result = res.data;
        } else {
          console.error('[FeedView] translate failed:', res.error);
          return;
        }
      }
      if (result) {
        setTranslatedItems(prev => {
          const next = new Map(prev);
          next.set(itemId, { title: result.title || '', summary: result.summary || '' });
          return next;
        });
        setShowTranslation(prev => {
          const next = new Map(prev);
          next.set(itemId, true);
          return next;
        });
      }
    } catch (err) {
      console.error('[FeedView] translate error:', err);
    } finally {
      setTranslating(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const filteredSources = filter.sourceType === 'all'
    ? sources
    : sources.filter((s) => s.type === filter.sourceType);

  const loadReadingContent = useCallback(async (url: string) => {
    setReadingLoading(true);
    try {
      const result = await feedApi.extractContent(url);
      if (result) {
        setReadingContent(result);
      } else {
        setReadingContent(null);
      }
    } catch (err) {
      console.error('阅读模式提取内容失败:', err);
      setReadingContent(null);
    } finally {
      setReadingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (readingMode && previewUrl && !readingContent && !readingLoading) {
      loadReadingContent(previewUrl);
    }
  }, [readingMode, previewUrl]);

  const itemCategoryFilterSources = filter.category
    ? filteredSources.filter((s) => (s.category || '') === filter.category)
    : filteredSources;

  const itemUniqueCategories = Array.from(
    new Set(sources.map((s) => s.category || '').filter(Boolean)),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        {viewMode === 'items' ? (
          <>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">知识流</h1>
              <button
                type="button"
                onClick={() => setViewMode('sources')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <ArrowLeftRight className="h-4 w-4" />
                管理知识源
              </button>
            </div>
            <span className="text-sm text-gray-400">共 {total} 条</span>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">知识源管理</h1>
            <button
              type="button"
              onClick={() => {
                setViewMode('items');
                setSelectedSourceIds(new Set());
                setSourceFormMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              返回知识流
            </button>
          </div>
        )}
      </div>

      {viewMode === 'items' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              {SOURCE_TYPE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setFilter((prev) => ({ ...prev, sourceType: tab.key, sourceId: null }));
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter.sourceType === tab.key
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={filter.sourceId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setFilter((prev) => ({ ...prev, sourceId: val ? Number(val) : null }));
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部来源</option>
              {itemCategoryFilterSources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {itemUniqueCategories.length > 0 && (
              <select
                value={filter.category}
                onChange={(e) => {
                  setFilter((prev) => ({ ...prev, category: e.target.value, sourceId: null }));
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全部分类</option>
                {itemUniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                defaultValue={filter.keyword}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="搜索标题或摘要..."
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setFilter((prev) => ({ ...prev, starredOnly: !prev.starredOnly }));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                filter.starredOnly
                  ? 'border-yellow-400 bg-yellow-50 text-yellow-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Star className={`h-4 w-4 ${filter.starredOnly ? 'fill-yellow-400' : ''}`} />
              标星
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5">
              <span className="text-sm text-blue-700">已选择 {selectedIds.size} 项</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                取消选择
              </button>
              <button
                type="button"
                onClick={() => openFolderDialog(Array.from(selectedIds))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                批量入库 ({selectedIds.size})
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          )}

          {!loading && displayItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Rss className="mb-3 h-12 w-12" />
              <p className="text-lg">暂无订阅内容</p>
              <p className="mt-1 text-sm">添加 RSS 或 GitHub 源以获取更新</p>
            </div>
          )}

          {!loading && displayItems.length > 0 && (
            <div className="space-y-3">
              {displayItems.map((item) => {
                const sourceType = item.source?.type ?? 'rss';
                const SourceIcon = sourceType === 'github' ? Github : Rss;

                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-shrink-0">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${sourceType === 'github' ? 'bg-gray-100' : 'bg-orange-100'}`}>
                        <SourceIcon className={`h-4 w-4 ${sourceType === 'github' ? 'text-gray-700' : 'text-orange-600'}`} />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setPreviewUrl(item.url); setPreviewTitle(item.title); setReadingMode(true); setReadingContent(null); loadReadingContent(item.url); }}
                          className="truncate text-base font-medium text-gray-800 transition-colors hover:text-blue-600"
                        >
                          {showTranslation.get(item.id) && translatedItems.get(item.id)?.title
                            ? translatedItems.get(item.id)!.title
                            : item.title}
                        </a>
                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                        <button
                          type="button"
                          onClick={() => handleTranslate(item.id)}
                          disabled={translating.has(item.id)}
                          className="ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-500 disabled:opacity-50"
                          title={showTranslation.get(item.id) ? '显示原文' : '翻译为中文'}
                        >
                          <Languages className="h-3.5 w-3.5" />
                          {translating.has(item.id) ? '...' : showTranslation.get(item.id) ? '原文' : '译'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => { await feedApi.toggleStar(item.id); loadItems(page); }}
                          className={`ml-1 inline-flex items-center rounded px-1 py-0.5 text-xs transition-colors hover:bg-yellow-50 ${
                            item.isStarred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                          }`}
                          title={item.isStarred ? '取消标星' : '标星'}
                        >
                          <Star className={`h-3.5 w-3.5 ${item.isStarred ? 'fill-yellow-400' : ''}`} />
                        </button>
                      </div>

                      {item.summary && (
                        <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-gray-500">
                          {showTranslation.get(item.id) && translatedItems.get(item.id)?.summary
                            ? translatedItems.get(item.id)!.summary
                            : item.summary}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        {item.author && <span>{item.author}</span>}
                        {item.publishedAt && <span>{formatRelativeTime(item.publishedAt)}</span>}
                        {item.source && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            <SourceIcon className="h-3 w-3" />
                            {item.source.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {item.importedItemId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          已入库
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openFolderDialog([item.id])}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          入库
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-300 p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-500">
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-300 p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {viewMode === 'sources' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".opml,.xml"
              className="hidden"
              id="opml-file-input-2"
              onChange={handleOpmlFileChange}
            />
            <button
              type="button"
              onClick={handleImportOpml}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              导入 OPML
            </button>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">添加知识源</h3>
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="text"
                value={sourceForm.name}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="订阅源名称"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-40"
              />
              <input
                type="text"
                value={sourceForm.url}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="Feed URL"
                className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-60"
              />
              <select
                value={sourceForm.type}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, type: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="rss">RSS</option>
                <option value="github">GitHub</option>
              </select>
              <input
                type="text"
                value={sourceForm.category}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="分类，如：AI 研究"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-36"
              />
              <button
                type="button"
                onClick={handleAddSource}
                disabled={sourceFormLoading}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {sourceFormLoading ? '添加中...' : '添加'}
              </button>
            </div>
            {sourceFormMessage && (
              <div className={`mt-3 rounded-md px-3 py-2 text-sm ${sourceFormMessage.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {sourceFormMessage.msg}
              </div>
            )}
          </div>

          <div className="mb-4 flex items-center gap-3">
            <select
              value={sourceCategoryFilter}
              onChange={(e) => setSourceCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部分类</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <span className="text-sm text-gray-400">共 {filteredSourcesByCategory.length} 个源</span>
          </div>

          {selectedSourceIds.size > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5">
              <span className="text-sm text-blue-700">已选择 {selectedSourceIds.size} 项</span>
              <button
                type="button"
                onClick={() => setSelectedSourceIds(new Set())}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                取消选择
              </button>
              <button
                type="button"
                onClick={handleBatchDeleteSources}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                批量删除 ({selectedSourceIds.size})
              </button>
            </div>
          )}

          <div className="space-y-2">
            {filteredSourcesByCategory.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2">
                <input
                  type="checkbox"
                  checked={filteredSourcesByCategory.length > 0 && filteredSourcesByCategory.every((s) => selectedSourceIds.has(s.id))}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selectedSourceIds.size > 0 && !filteredSourcesByCategory.every((s) => selectedSourceIds.has(s.id));
                    }
                  }}
                  onChange={() => {
                    const allSelected = filteredSourcesByCategory.every((s) => selectedSourceIds.has(s.id));
                    if (allSelected) {
                      setSelectedSourceIds(new Set());
                    } else {
                      setSelectedSourceIds(new Set(filteredSourcesByCategory.map((s) => s.id)));
                    }
                  }}
                  className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">全选</span>
              </div>
            )}
            {filteredSourcesByCategory.map((source) => (
              <div
                key={source.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm transition-all hover:border-gray-200"
              >
                <input
                  type="checkbox"
                  checked={selectedSourceIds.has(source.id)}
                  onChange={() => toggleSourceSelect(source.id)}
                  className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {source.category && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {source.category}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-gray-800">{source.name}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${source.type === 'rss' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                      {source.type === 'rss' ? 'RSS' : 'GitHub'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-400">{source.url}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {source.lastFetchedAt && (
                      <span className="text-xs text-gray-300">上次获取：{formatRelativeTime(source.lastFetchedAt)}</span>
                    )}
                    {source.failCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-500" title={source.lastError || ''}>
                        失败 {source.failCount} 次{source.failCount >= 3 ? '（已自动禁用）' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSource(source.id, source.enabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${source.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${source.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSource(source.id)}
                    className="rounded p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredSourcesByCategory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Rss className="mb-3 h-12 w-12" />
              <p className="text-lg">暂无知识源</p>
            </div>
          )}

          {presetSources.length > 0 && (
            <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">预置 AI 订阅源</h3>
              <div className="grid grid-cols-1 gap-2">
                {presetSources.map((preset: any) => {
                  const alreadyAdded = sources.some((s) => s.url === preset.url);
                  return (
                    <div key={preset.url} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800">{preset.name}</div>
                        {preset.description && (
                          <div className="mt-0.5 text-xs text-gray-400">{preset.description}</div>
                        )}
                      </div>
                      {alreadyAdded ? (
                        <span className="ml-4 inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          已添加
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddPresetSource(preset)}
                          disabled={sourceFormLoading}
                          className="ml-4 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                        >
                          添加
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <h3 className="truncate text-sm font-medium text-gray-700">{previewTitle}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (readingMode) {
                    if (!readingContent && !readingLoading) {
                      loadReadingContent(previewUrl);
                    } else {
                      setReadingMode(false);
                    }
                  } else {
                    setReadingMode(true);
                    if (!readingContent) {
                      loadReadingContent(previewUrl);
                    }
                  }
                }}
                disabled={readingLoading}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${readingMode ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'} disabled:opacity-50`}
                title={readingMode ? '原始页面' : '阅读模式'}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {readingLoading ? '加载中...' : readingMode ? '原始页面' : '阅读模式'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (readingMode && readingContainerRef.current) {
                    readingContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                  } else if (webviewRef.current) {
                    webviewRef.current.executeJavaScript('window.scrollTo(0, 0)').catch(() => {});
                  }
                }}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="回到顶部"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => window.open(previewUrl, '_blank')}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="外部打开"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => { setPreviewUrl(null); setPreviewTitle(''); setReadingMode(false); setReadingContent(null); }}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {readingMode && readingContent ? (
            <div
              ref={(el) => {
                readingContainerRef.current = el;
                if (el) {
                  el.onscroll = () => setShowScrollTop(el.scrollTop > 300);
                }
              }}
              className="flex-1 overflow-y-auto bg-white px-4 py-8"
            >
              <div className="mx-auto max-w-3xl">
                <h1 className="mb-4 text-2xl font-bold text-gray-900">{readingContent.title}</h1>
                <div className="mb-4 flex items-center gap-3 text-sm text-gray-500">
                  {readingContent.author && <span>{readingContent.author}</span>}
                  {readingContent.siteName && <span>· {readingContent.siteName}</span>}
                </div>
                <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600" dangerouslySetInnerHTML={{ __html: readingContent.contentHtml }} />
              </div>
            </div>
          ) : readingMode && readingLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <span className="text-sm">正在提取正文...</span>
              </div>
            </div>
          ) : readingMode && !readingContent ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <BookOpen className="h-12 w-12" />
                <span className="text-sm">无法提取正文内容</span>
                <button
                  type="button"
                  onClick={() => { setReadingMode(false); }}
                  className="mt-2 rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                >
                  查看原始页面
                </button>
              </div>
            </div>
          ) : (
            <webview
              ref={webviewRef as any}
              src={previewUrl}
              className="flex-1"
              style={{ width: '100%', height: '100%' }}
            />
          )}
          {readingMode && showScrollTop && (
            <button
              type="button"
              onClick={() => readingContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
              title="回到顶部"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
          {!readingMode && (
            <button
              type="button"
              onClick={() => webviewRef.current?.executeJavaScript('window.scrollTo({top:0,behavior:"smooth"})').catch(() => {})}
              className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
              title="回到顶部"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {showFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">选择目标文件夹</h3>
            <div className="max-h-60 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedFolderId === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
              >
                根目录
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${selectedFolderId === folder.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                  style={{ paddingLeft: `${(folder.depth + 1) * 16 + 12}px` }}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  {folder.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowFolderDialog(false); setImportTargetIds([]); }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {importProgress ? `导入中 ${importProgress.current}/${importProgress.total}` : '导入中...'}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    确认入库
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedView;
