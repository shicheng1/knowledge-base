import React, { useCallback } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  FileCode,
  Link,
  Image,
  List,
  ListOrdered,
  CheckSquare,
  Table,
  Minus,
} from 'lucide-react';

interface MarkdownToolbarProps {
  onFormat: (type: string) => void;
}

const formatActions: { icon: React.ReactNode; label: string; action: string; shortcut?: string }[] = [
  { icon: <Heading1 className="h-4 w-4" />, label: '标题 1', action: 'h1', shortcut: 'Ctrl+1' },
  { icon: <Heading2 className="h-4 w-4" />, label: '标题 2', action: 'h2', shortcut: 'Ctrl+2' },
  { icon: <Heading3 className="h-4 w-4" />, label: '标题 3', action: 'h3', shortcut: 'Ctrl+3' },
  { icon: <Bold className="h-4 w-4" />, label: '加粗', action: 'bold', shortcut: 'Ctrl+B' },
  { icon: <Italic className="h-4 w-4" />, label: '斜体', action: 'italic', shortcut: 'Ctrl+I' },
  { icon: <Strikethrough className="h-4 w-4" />, label: '删除线', action: 'strikethrough' },
  { icon: <Quote className="h-4 w-4" />, label: '引用', action: 'quote' },
  { icon: <Code className="h-4 w-4" />, label: '行内代码', action: 'code' },
  { icon: <FileCode className="h-4 w-4" />, label: '代码块', action: 'codeblock' },
  { icon: <Link className="h-4 w-4" />, label: '链接', action: 'link' },
  { icon: <Image className="h-4 w-4" />, label: '图片', action: 'image' },
  { icon: <List className="h-4 w-4" />, label: '无序列表', action: 'ul' },
  { icon: <ListOrdered className="h-4 w-4" />, label: '有序列表', action: 'ol' },
  { icon: <CheckSquare className="h-4 w-4" />, label: '任务列表', action: 'task' },
  { icon: <Table className="h-4 w-4" />, label: '表格', action: 'table' },
  { icon: <Minus className="h-4 w-4" />, label: '分割线', action: 'hr' },
];

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onFormat }) => {
  const handleClick = useCallback(
    (action: string) => {
      onFormat(action);
    },
    [onFormat],
  );

  return (
    <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      {formatActions.map((item) => (
        <button
          key={item.action}
          type="button"
          title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
          onClick={() => handleClick(item.action)}
          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 active:text-blue-600"
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default MarkdownToolbar;
