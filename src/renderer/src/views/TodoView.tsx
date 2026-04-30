import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ExternalLink, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';

interface TodoSourceItem {
  id: number;
  title: string;
  content: string;
  updated_at: string;
}

interface TodoLine {
  itemId: number;
  itemTitle: string;
  itemUpdatedAt: string;
  line: number;
  text: string;
  done: boolean;
}

type Filter = 'all' | 'pending' | 'done';

const TODO_REGEX = /^(\s*)-\s+\[( |x|X)\]\s+(.*)$/;

const parseTodos = (items: TodoSourceItem[]): TodoLine[] => {
  const result: TodoLine[] = [];
  for (const item of items) {
    if (!item.content) continue;
    const lines = item.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = TODO_REGEX.exec(lines[i]);
      if (!m) continue;
      result.push({
        itemId: item.id,
        itemTitle: item.title,
        itemUpdatedAt: item.updated_at,
        line: i,
        text: m[3].trim(),
        done: m[2].toLowerCase() === 'x',
      });
    }
  }
  return result;
};

const TodoView: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TodoSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.item.searchTodos();
      setItems(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(err?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const todos = useMemo(() => parseTodos(items), [items]);

  const filtered = useMemo(() => {
    if (filter === 'pending') return todos.filter((t) => !t.done);
    if (filter === 'done') return todos.filter((t) => t.done);
    return todos;
  }, [todos, filter]);

  const grouped = useMemo(() => {
    const map = new Map<number, { title: string; updatedAt: string; todos: TodoLine[] }>();
    for (const todo of filtered) {
      if (!map.has(todo.itemId)) {
        map.set(todo.itemId, {
          title: todo.itemTitle,
          updatedAt: todo.itemUpdatedAt,
          todos: [],
        });
      }
      map.get(todo.itemId)!.todos.push(todo);
    }
    return Array.from(map.entries()).map(([id, group]) => ({ id, ...group }));
  }, [filtered]);

  const toggleTodo = async (todo: TodoLine) => {
    const item = items.find((i) => i.id === todo.itemId);
    if (!item) return;
    const lines = item.content.split(/\r?\n/);
    const target = lines[todo.line];
    if (!target) return;
    const replaced = todo.done
      ? target.replace(/-\s+\[[xX]\]/, '- [ ]')
      : target.replace(/-\s+\[ \]/, '- [x]');
    lines[todo.line] = replaced;
    const newContent = lines.join('\n');
    try {
      await window.api.item.update(item.id, { content: newContent });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, content: newContent, updated_at: new Date().toISOString() } : i)),
      );
    } catch (err: any) {
      alert('更新失败：' + (err?.message ?? ''));
    }
  };

  const counts = {
    all: todos.length,
    pending: todos.filter((t) => !t.done).length,
    done: todos.filter((t) => t.done).length,
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
          <CheckSquare className="h-6 w-6 text-blue-500" />
          TODO 聚合
        </h1>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {(['pending', 'all', 'done'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                filter === f ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'pending' ? `待办 ${counts.pending}` : f === 'done' ? `已完成 ${counts.done}` : `全部 ${counts.all}`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center text-gray-400">
          暂无 TODO
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.id} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <button
                  type="button"
                  onClick={() => navigate(`/item/${group.id}`)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {group.title}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-gray-400">{dayjs(group.updatedAt).format('MM-DD HH:mm')}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {group.todos.map((todo) => (
                  <label
                    key={`${todo.itemId}-${todo.line}`}
                    className="flex items-start gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    <span className={`flex-1 text-sm ${todo.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {todo.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodoView;
