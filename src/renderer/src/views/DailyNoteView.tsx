import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import MarkdownEditor from '../components/editor/MarkdownEditor';

const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');

const DailyNoteView: React.FC = () => {
  const { date: routeDate } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const today = fmt(dayjs());
  const date = routeDate || today;

  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.item.getOrCreateDailyNote(date);
      setItem(data);
      setContent(data?.content ?? '');
    } catch (err: any) {
      console.error('加载每日笔记失败:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await window.api.item.update(item.id, { content });
    } catch (err: any) {
      alert('保存失败：' + (err?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => navigate(`/daily/${fmt(dayjs(date).subtract(1, 'day'))}`);
  const goNext = () => navigate(`/daily/${fmt(dayjs(date).add(1, 'day'))}`);
  const goToday = () => navigate(`/daily/${today}`);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
          <Calendar className="h-6 w-6 text-blue-500" />
          每日笔记
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
            title="前一天"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => navigate(`/daily/${e.target.value}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={goNext}
            className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-50"
            title="后一天"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-blue-500 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
          >
            今天
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <MarkdownEditor
          content={content}
          onChange={setContent}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          placeholder={`# ${date}\n\n记录今天的想法、计划、TODO...`}
          itemId={item?.id}
        />
      )}
    </div>
  );
};

export default DailyNoteView;
