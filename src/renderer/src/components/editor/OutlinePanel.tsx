import React, { useMemo } from 'react';
import { List } from 'lucide-react';

interface OutlineItem {
  level: number;
  text: string;
  line: number;
}

const parseOutline = (content: string): OutlineItem[] => {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const result: OutlineItem[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      result.push({
        level: match[1].length,
        text: match[2].replace(/[#`*_~]/g, ''),
        line: i + 1,
      });
    }
  }
  return result;
};

interface OutlinePanelProps {
  content: string;
  onJumpToLine?: (line: number) => void;
}

const OutlinePanel: React.FC<OutlinePanelProps> = ({ content, onJumpToLine }) => {
  const outline = useMemo(() => parseOutline(content), [content]);

  if (outline.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-400">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <List className="h-3.5 w-3.5" />
          大纲
        </div>
        暂无标题
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <List className="h-3.5 w-3.5" />
        大纲
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {outline.map((item, idx) => (
          <button
            key={`${item.line}-${idx}`}
            type="button"
            onClick={() => onJumpToLine?.(item.line)}
            className="block w-full truncate rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600"
            style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
            title={item.text}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OutlinePanel;
