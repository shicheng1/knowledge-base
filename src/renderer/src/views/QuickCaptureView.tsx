import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, FolderOpen, Tag as TagIcon } from 'lucide-react';

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

const QuickCaptureView: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [folderTree, setFolderTree] = useState<FolderItem[]>([]);

  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Load metadata
  useEffect(() => {
    Promise.all([
      window.api.tag.getAll().catch(() => []),
      window.api.folder.getTree().catch(() => []),
    ]).then(([t, f]) => {
      setTags(t ?? []);
      setFolderTree(f ?? []);
    });
  }, []);

  // Focus content on mount and when window is shown
  useEffect(() => {
    const handleFocus = () => {
      setTimeout(() => {
        contentRef.current?.focus();
      }, 100);
    };

    handleFocus();

    const unsubscribe = window.api.on('quick-capture:focus', handleFocus);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !content.trim()) {
      window.close();
      return;
    }
    setSaving(true);
    try {
      await window.api.item.create({
        title: title.trim() || '未命名笔记',
        content: content.trim(),
        content_type: 'note',
        folder_id: folderId,
        tagIds: selectedTagIds,
      });
    } catch (err) {
      console.error('快速捕获保存失败:', err);
    } finally {
      setSaving(false);
      // Hide window after save
      window.close();
    }
  }, [title, content, folderId, selectedTagIds]);

  // Ctrl+Enter to save, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        window.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
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

  return (
    <div className="flex h-screen flex-col bg-white select-none" style={{ WebkitAppRegion: 'drag' as any }}>
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2" style={{ WebkitAppRegion: 'drag' as any }}>
        <span className="text-xs font-medium text-gray-400">快速捕获</span>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col gap-3 p-4" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可选）"
          className="w-full border-b border-gray-100 px-1 py-2 text-lg font-medium text-gray-800 placeholder-gray-300 outline-none focus:border-blue-400"
        />

        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入内容...  Ctrl+Enter 保存"
          className="flex-1 resize-none rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-blue-400 focus:bg-white"
          rows={6}
        />

        {/* Folder & Tags */}
        <div className="flex gap-3">
          <div className="flex-1">
            <select
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-blue-400"
            >
              <option value="">无文件夹</option>
              {flatFolders.map((f) => (
                <option key={f.id} value={f.id} className="max-w-[200px] truncate">
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity ${
                    selected ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    border: selected ? `1px solid ${tag.color}` : '1px solid transparent',
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-gray-50 pt-2">
          <span className="text-[11px] text-gray-300">Ctrl+Enter 保存 · Esc 关闭</span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickCaptureView;
