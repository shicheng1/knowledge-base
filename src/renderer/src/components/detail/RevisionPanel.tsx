import React, { useEffect, useState } from 'react';
import { History, RotateCcw, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import dayjs from 'dayjs';

interface Revision {
  id: number;
  itemId: number;
  title: string | null;
  content: string | null;
  revisionNumber: number;
  createdAt: string;
}

interface RevisionPanelProps {
  itemId: number;
  onRestored?: () => void;
}

const RevisionPanel: React.FC<RevisionPanelProps> = ({ itemId, onRestored }) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const loadRevisions = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const data = await window.api.item.getRevisions(itemId);
      setRevisions(data ?? []);
    } catch (err) {
      console.error('Failed to load revisions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      loadRevisions();
    }
  }, [expanded, itemId]);

  const handleRestore = async (revisionId: number) => {
    if (!confirm('确定要恢复到此版本吗？当前内容将被替换。')) return;
    setRestoring(revisionId);
    try {
      await window.api.item.restoreRevision(revisionId);
      setRestoring(null);
      onRestored?.();
    } catch (err) {
      console.error('Failed to restore revision:', err);
      alert('恢复失败');
      setRestoring(null);
    }
  };

  const previewContent = (content: string | null) => {
    if (!content) return '(空内容)';
    return content.length > 200 ? content.slice(0, 200) + '...' : content;
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <History className="h-4 w-4" />
        编辑历史
        {revisions.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
            {revisions.length}
          </span>
        )}
        {expanded ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {loading && (
            <div className="py-4 text-center text-sm text-gray-400">加载中...</div>
          )}

          {!loading && revisions.length === 0 && (
            <div className="py-4 text-center text-sm text-gray-400">
              暂无编辑历史，保存修改后将自动记录
            </div>
          )}

          {revisions.map((rev) => (
            <div
              key={rev.id}
              className="rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    v{rev.revisionNumber}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {dayjs(rev.createdAt).format('MM-DD HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedVersion(expandedVersion === rev.id ? null : rev.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {expandedVersion === rev.id ? '收起' : '预览'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestore(rev.id)}
                    disabled={restoring === rev.id}
                    className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {restoring === rev.id ? '恢复中...' : '恢复'}
                  </button>
                </div>
              </div>

              {expandedVersion === rev.id && (
                <div className="mt-2 rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700">
                    {rev.title || '(无标题)'}
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-600">
                    {previewContent(rev.content)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RevisionPanel;
