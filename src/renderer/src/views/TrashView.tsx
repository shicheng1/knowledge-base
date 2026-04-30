import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Image,
  Code,
  Bookmark,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';

interface TrashItem {
  id: number;
  title: string;
  content_type: string;
  deleted_at: string;
  created_at: string;
  summary: string | null;
}

const CONTENT_TYPE_ICON: Record<string, React.ElementType> = {
  note: FileText,
  article: FileText,
  bookmark: Bookmark,
  file: FolderOpen,
  code: Code,
  image: Image,
  other: FileText,
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  note: '笔记',
  article: '文章',
  bookmark: '书签',
  file: '文件',
  code: '代码',
  image: '图片',
  other: '其他',
};

const TrashView: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState<number | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.item.getTrashList({ page, pageSize });
      setItems(result?.data ?? []);
      setTotal(result?.total ?? 0);
    } catch (err) {
      console.error('加载回收站失败:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = async (id: number) => {
    try {
      await window.api.item.restore(id);
      loadTrash();
    } catch (err: any) {
      alert('恢复失败: ' + (err?.message ?? '未知错误'));
    }
  };

  const handlePermanentDelete = async (id: number) => {
    try {
      await window.api.item.permanentDelete(id);
      setShowPermanentDeleteConfirm(null);
      loadTrash();
    } catch (err: any) {
      alert('永久删除失败: ' + (err?.message ?? '未知错误'));
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await window.api.item.emptyTrash();
      setShowEmptyConfirm(false);
      loadTrash();
    } catch (err: any) {
      alert('清空回收站失败: ' + (err?.message ?? '未知错误'));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">回收站</h1>
        {total > 0 && (
          <button
            type="button"
            onClick={() => setShowEmptyConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            清空回收站
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Trash2 className="mb-3 h-12 w-12" />
          <p className="text-lg">回收站为空</p>
          <p className="mt-1 text-sm">删除的条目会出现在这里</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-400">
            共 {total} 个已删除条目
          </p>

          <div className="space-y-2">
            {items.map((item) => {
              const IconComp = CONTENT_TYPE_ICON[item.content_type] ?? FileText;
              const typeLabel = CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type;

              return (
                <div
                  key={item.id}
                  className="group rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <IconComp className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <h3 className="truncate text-base font-medium text-gray-800">
                          {item.title}
                        </h3>
                        <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          {typeLabel}
                        </span>
                      </div>
                      {item.summary && (
                        <p className="mb-1 truncate text-sm text-gray-500">
                          {item.summary}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        删除于 {dayjs(item.deleted_at).format('YYYY-MM-DD HH:mm')}
                        {' · '}
                        创建于 {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(item.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        恢复
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPermanentDeleteConfirm(item.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        永久删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-300 p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-800">清空回收站</h3>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              确定要永久删除回收站中的所有 {total} 个条目吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmptyConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                永久删除全部
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermanentDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-800">永久删除</h3>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              确定要永久删除此条目吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPermanentDeleteConfirm(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handlePermanentDelete(showPermanentDeleteConfirm)}
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

export default TrashView;
