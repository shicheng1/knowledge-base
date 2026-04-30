import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  FolderPlus,
  Settings,
  BarChart3,
  Star,
  Trash2,
  Calendar,
  CheckSquare,
  Network,
  Home,
  Tag as TagIcon,
} from 'lucide-react';

type Mode = 'jump' | 'command' | 'closed';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

interface JumpItem {
  id: number;
  title: string;
}

const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, i);
    if (idx === -1) return false;
    i = idx + 1;
  }
  return true;
};

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('closed');
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [jumpResults, setJumpResults] = useState<JumpItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setMode('closed');
    setQuery('');
    setActiveIdx(0);
    setJumpResults([]);
  }, []);

  const commands = useMemo<CommandItem[]>(
    () => [
      { id: 'home', label: '前往首页', icon: <Home className="h-4 w-4" />, run: () => navigate('/') },
      { id: 'fav', label: '收藏夹', icon: <Star className="h-4 w-4" />, run: () => navigate('/favorites') },
      { id: 'search', label: '打开搜索', icon: <Search className="h-4 w-4" />, run: () => navigate('/search') },
      { id: 'stats', label: '统计仪表盘', icon: <BarChart3 className="h-4 w-4" />, run: () => navigate('/stats') },
      { id: 'graph', label: '知识图谱', icon: <Network className="h-4 w-4" />, run: () => navigate('/graph') },
      { id: 'daily', label: '今日笔记', icon: <Calendar className="h-4 w-4" />, run: () => navigate('/daily') },
      { id: 'todos', label: 'TODO 聚合', icon: <CheckSquare className="h-4 w-4" />, run: () => navigate('/todos') },
      { id: 'trash', label: '回收站', icon: <Trash2 className="h-4 w-4" />, run: () => navigate('/trash') },
      { id: 'settings', label: '打开设置', icon: <Settings className="h-4 w-4" />, run: () => navigate('/settings') },
      {
        id: 'new-note',
        label: '新建笔记',
        icon: <FileText className="h-4 w-4" />,
        run: async () => {
          const id = await window.api.item.create({
            title: '未命名笔记',
            content: '',
            content_type: 'note',
          });
          if (id) navigate(`/item/${id}?edit=true`);
        },
      },
      {
        id: 'new-folder',
        label: '新建根文件夹',
        icon: <FolderPlus className="h-4 w-4" />,
        run: async () => {
          const name = window.prompt('输入文件夹名称');
          if (name?.trim()) {
            await window.api.folder.create({ name: name.trim(), parent_id: null });
          }
        },
      },
      {
        id: 'register-shell',
        label: '注册 Windows 右键菜单',
        icon: <Settings className="h-4 w-4" />,
        run: async () => {
          try {
            await window.api.shell.registerMenu();
            alert('右键菜单注册成功');
          } catch (err: any) {
            alert('注册失败：' + (err?.message ?? ''));
          }
        },
      },
    ],
    [navigate],
  );

  const filteredCommands = useMemo(
    () =>
      commands.filter((c) => fuzzyMatch(c.label, query) || fuzzyMatch(c.id, query)),
    [commands, query],
  );

  const list = mode === 'command' ? filteredCommands : jumpResults;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setMode('command');
        setQuery('');
        setActiveIdx(0);
        return;
      }
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setMode('jump');
        setQuery('');
        setActiveIdx(0);
        return;
      }
      if (e.key === 'Escape' && mode !== 'closed') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, close]);

  useEffect(() => {
    if (mode !== 'closed') {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'jump') return;
    let cancelled = false;
    const run = async () => {
      if (!query.trim()) {
        try {
          const list = await window.api.item.getList({ pageSize: 30 });
          if (!cancelled && list?.data) {
            setJumpResults(list.data.map((it: any) => ({ id: it.id, title: it.title })));
          }
        } catch {
          if (!cancelled) setJumpResults([]);
        }
        return;
      }
      try {
        const suggestions = await window.api.item.searchSuggestions(query);
        if (!cancelled && Array.isArray(suggestions)) {
          setJumpResults(suggestions);
        }
      } catch {
        if (!cancelled) setJumpResults([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [query, mode]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, mode]);

  if (mode === 'closed') return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = list[activeIdx];
      if (!target) return;
      if (mode === 'command') {
        (target as CommandItem).run();
      } else {
        navigate(`/item/${(target as JumpItem).id}`);
      }
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          {mode === 'command' ? (
            <Settings className="h-4 w-4 text-gray-400" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'command' ? '输入命令...' : '搜索条目标题...'}
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {mode === 'command' ? 'Ctrl+Shift+P' : 'Ctrl+P'}
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {list.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">无匹配结果</div>
          )}
          {list.map((item, idx) => {
            const active = idx === activeIdx;
            if (mode === 'command') {
              const cmd = item as CommandItem;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => {
                    cmd.run();
                    close();
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="text-gray-400">{cmd.icon}</span>
                  <span className="flex-1 truncate">{cmd.label}</span>
                </button>
              );
            }
            const jump = item as JumpItem;
            return (
              <button
                key={jump.id}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  navigate(`/item/${jump.id}`);
                  close();
                }}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="flex-1 truncate">{jump.title}</span>
                <TagIcon className="h-3 w-3 text-gray-300" />
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          <span>↑↓ 选择 · Enter 确认 · Esc 关闭</span>
          <span>Ctrl+P 跳转 · Ctrl+Shift+P 命令</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
