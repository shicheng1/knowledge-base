import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Filter, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface SearchResult {
  id: number;
  title: string;
  summary: string;
  content_type: string;
  source_url: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface TagItem {
  id: number;
  name: string;
  color: string;
}

const CONTENT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  note: { label: '笔记', color: 'bg-yellow-100 text-yellow-700' },
  article: { label: '文章', color: 'bg-purple-100 text-purple-700' },
  bookmark: { label: '书签', color: 'bg-blue-100 text-blue-700' },
  file: { label: '文件', color: 'bg-green-100 text-green-700' },
  code: { label: '代码', color: 'bg-indigo-100 text-indigo-700' },
  image: { label: '图片', color: 'bg-pink-100 text-pink-700' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700' },
};

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_MAP);

function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const SEARCH_HISTORY_KEY = 'knowledge-base-search-history';
const MAX_HISTORY = 20;

function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addSearchHistory(keyword: string) {
  if (!keyword.trim()) return;
  const history = getSearchHistory().filter((h) => h !== keyword.trim());
  history.unshift(keyword.trim());
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

const SearchView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTag = searchParams.get('tag');

  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [selectedTagId, setSelectedTagId] = useState<number | null>(
    initialTag ? Number(initialTag) : null,
  );
  const [tags, setTags] = useState<TagItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [suggestions, setSuggestions] = useState<Array<{ id: number; title: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(getSearchHistory());
  const [showHistory, setShowHistory] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const list = await window.api.tag.getAll();
        setTags(list ?? []);
      } catch (err) {
        console.error('加载标签失败:', err);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    if (initialTag) {
      handleSearch();
    }
  }, [initialTag]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (keyword.trim().length > 0) {
      setShowHistory(false);
      const timer = setTimeout(async () => {
        try {
          const s = await window.api.item.searchSuggestions(keyword.trim());
          setSuggestions(s ?? []);
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [keyword]);

  const handleSearch = useCallback(async (searchPage?: number) => {
    if (!keyword.trim() && !selectedTagId) return;
    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);
    setShowHistory(false);
    try {
      const options: any = { page: searchPage ?? page, pageSize };
      if (contentTypeFilter !== 'all') {
        options.content_type = contentTypeFilter;
      }
      if (selectedTagId) {
        options.tag_id = selectedTagId;
      }
      const res = await window.api.item.search(keyword.trim(), options);
      const paginated = res?.data ? res : { data: res?.items ?? res ?? [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      setResults(Array.isArray(paginated.data) ? paginated.data : []);
      setTotal(paginated.total ?? 0);
      setPage(paginated.page ?? 1);
      if (keyword.trim()) {
        addSearchHistory(keyword.trim());
        setSearchHistory(getSearchHistory());
      }
    } catch (err: any) {
      console.error('搜索失败:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, contentTypeFilter, selectedTagId, page, pageSize]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    handleSearch(newPage);
  };

  const handleClear = () => {
    setKeyword('');
    setResults([]);
    setSearched(false);
    setContentTypeFilter('all');
    setSelectedTagId(null);
    setPage(1);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (title: string) => {
    setKeyword(title);
    setShowSuggestions(false);
    setPage(1);
    setTimeout(() => handleSearch(1), 0);
  };

  const handleHistoryClick = (histKeyword: string) => {
    setKeyword(histKeyword);
    setShowHistory(false);
    setPage(1);
    setTimeout(() => handleSearch(1), 0);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
    setShowHistory(false);
  };

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + '...' : text;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">搜索</h1>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onFocus={() => {
              if (!keyword.trim() && searchHistory.length > 0) {
                setShowHistory(true);
              }
            }}
            placeholder="输入关键词搜索..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {keyword && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSuggestionClick(s.title)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-blue-50"
                >
                  <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <HighlightText text={s.title} keyword={keyword} />
                </button>
              ))}
            </div>
          )}

          {showHistory && searchHistory.length > 0 && (
            <div
              ref={historyRef}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <span className="text-xs font-medium text-gray-400">搜索历史</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  清空
                </button>
              </div>
              {searchHistory.map((hist, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleHistoryClick(hist)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-blue-50"
                >
                  <Clock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <span className="text-gray-600">{hist}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            showFilters || contentTypeFilter !== 'all' || selectedTagId
              ? 'bg-blue-50 text-blue-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Filter className="h-4 w-4" />
          筛选
        </button>
        <button
          type="button"
          onClick={() => handleSearch(page)}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          搜索
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <span className="mb-2 block text-xs font-semibold text-gray-400">内容类型</span>
            <div className="flex flex-wrap gap-1.5">
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
          </div>

          {tags.length > 0 && (
            <div>
              <span className="mb-2 block text-xs font-semibold text-gray-400">标签</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedTagId(null)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedTagId === null
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTagId(tag.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedTagId === tag.id
                        ? 'ring-2 ring-offset-1'
                        : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                      outline: selectedTagId === tag.id ? `2px solid ${tag.color}` : undefined,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!loading && searched && (
        <div>
          <p className="mb-4 text-sm text-gray-400">
            找到 {total} 条结果
          </p>

          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search className="mb-3 h-12 w-12" />
              <p className="text-lg">未找到匹配结果</p>
              <p className="mt-1 text-sm">尝试使用不同的关键词或筛选条件</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {results.map((item) => {
                  const typeCfg = CONTENT_TYPE_MAP[item.content_type] ?? {
                    label: item.content_type,
                    color: 'bg-gray-100 text-gray-600',
                  };

                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/item/${item.id}`)}
                      className="group cursor-pointer rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate text-base font-medium text-gray-800 group-hover:text-blue-600">
                          <HighlightText
                            text={item.title}
                            keyword={keyword}
                          />
                        </h3>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.color}`}
                        >
                          {typeCfg.label}
                        </span>
                      </div>
                      {item.summary && (
                        <p className="text-sm leading-relaxed text-gray-500">
                          <HighlightText
                            text={truncate(item.summary, 150)}
                            keyword={keyword}
                          />
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
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
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Search className="mb-3 h-12 w-12" />
          <p className="text-lg">输入关键词开始搜索</p>
          <p className="mt-1 text-sm">支持搜索标题、内容和摘要</p>
        </div>
      )}
    </div>
  );
};

export default SearchView;
