import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  CodeSquare,
  Link,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Palette,
  Table,
  SeparatorHorizontal,
  RemoveFormatting,
  Superscript,
  Subscript,
  SmilePlus,
  Maximize,
  Minimize,
  FileCode,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: any;
  itemId?: number;
  widthMode?: 'narrow' | 'wide' | 'full';
  onWidthModeChange?: (mode: 'narrow' | 'wide' | 'full') => void;
  onHtmlEdit?: (html: string) => void;
}

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

const EMOJI_LIST = [
  '😀', '😂', '🥹', '😊', '😍', '🤔', '😎', '🥳',
  '👍', '👏', '🎉', '❤️', '🔥', '⭐', '✅', '❌',
  '📌', '💡', '🚀', '🎯', '📝', '💻', '🔧', '📊',
  '📂', '🔗', '📎', '🔔', '⚡', '🌟', '🏆', '💬',
];

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`rounded p-1.5 transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-600'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
    } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="mx-1 h-6 w-px bg-gray-200" />;

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  itemId,
  widthMode = 'narrow',
  onWidthModeChange,
  onHtmlEdit,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) return null;

  const handleLinkInsert = () => {
    const url = window.prompt('输入链接 URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleImageInsert = async () => {
    if (!itemId) {
      const url = window.prompt('输入图片 URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
      return;
    }
    try {
      const result = await window.api.editor.selectImage(itemId);
      if (result?.localSrc) {
        editor.chain().focus().setImage({ src: result.localSrc }).run();
      }
    } catch (err) {
      console.error('选择图片失败:', err);
    }
  };

  const handleColorSelect = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const handleWidthToggle = () => {
    const modes: Array<'narrow' | 'wide' | 'full'> = ['narrow', 'wide', 'full'];
    const idx = modes.indexOf(widthMode);
    const next = modes[(idx + 1) % modes.length];
    onWidthModeChange?.(next);
  };

  const handleEmojiSelect = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
    setShowEmojiPicker(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="撤销"
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="重做"
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="加粗"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="斜体"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="下划线"
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="删除线"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="行内代码"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive('superscript')}
        title="上标"
      >
        <Superscript className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive('subscript')}
        title="下标"
      >
        <Subscript className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <div className="relative" ref={colorRef}>
        <ToolbarButton
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="文字颜色"
        >
          <Palette className="h-4 w-4" />
        </ToolbarButton>
        {showColorPicker && (
          <div className="absolute left-0 top-full z-30 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
            <div className="grid grid-cols-4 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className="h-6 w-6 rounded border border-gray-200 transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <input
                type="color"
                onChange={(e) => handleColorSelect(e.target.value)}
                className="h-8 w-full cursor-pointer"
                title="自定义颜色"
              />
            </div>
          </div>
        )}
      </div>
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="清除格式"
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="标题 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="标题 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="标题 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="无序列表"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="有序列表"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="任务列表"
      >
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="引用"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="代码块"
      >
        <CodeSquare className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="水平分割线"
      >
        <SeparatorHorizontal className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="左对齐"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="居中"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="右对齐"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="插入表格"
      >
        <Table className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={handleLinkInsert}
        isActive={editor.isActive('link')}
        title="插入链接"
      >
        <Link className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={handleImageInsert}
        title="插入图片"
      >
        <Image className="h-4 w-4" />
      </ToolbarButton>
      <div className="relative" ref={emojiRef}>
        <ToolbarButton
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Emoji"
        >
          <SmilePlus className="h-4 w-4" />
        </ToolbarButton>
        {showEmojiPicker && (
          <div className="absolute right-0 top-full z-30 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Divider />

      <ToolbarButton
        onClick={handleWidthToggle}
        title={`切换宽度: ${widthMode === 'narrow' ? '窄' : widthMode === 'wide' ? '宽' : '全屏'}`}
      >
        {widthMode === 'full' ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </ToolbarButton>
      {onHtmlEdit && (
        <ToolbarButton
          onClick={() => onHtmlEdit(editor.getHTML())}
          title="HTML 源码编辑"
        >
          <FileCode className="h-4 w-4" />
        </ToolbarButton>
      )}
    </div>
  );
};

export default EditorToolbar;
