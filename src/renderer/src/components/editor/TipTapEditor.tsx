import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { common, createLowlight } from 'lowlight';
import EditorToolbar from './EditorToolbar';

const lowlight = createLowlight(common);

interface TipTapEditorProps {
  content: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  itemId?: number;
  widthMode?: 'narrow' | 'wide' | 'full';
  onWidthModeChange?: (mode: 'narrow' | 'wide' | 'full') => void;
  onHtmlEdit?: (html: string) => void;
}

const widthClasses: Record<string, string> = {
  narrow: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: 'max-w-full',
};

const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  placeholder = '开始输入内容...',
  itemId,
  widthMode = 'narrow',
  onWidthModeChange,
  onHtmlEdit,
}) => {
  const handleDrop = useCallback(
    (view: any, event: DragEvent, _slice: any, moved: boolean) => {
      if (moved || !itemId || !event.dataTransfer?.files.length) return false;

      const file = event.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) return false;

      event.preventDefault();

      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const arr = Array.from(new Uint8Array(arrayBuffer));
        try {
          const localSrc = await window.api.editor.saveImageBuffer(itemId, arr, file.type);
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (pos) {
            view.dispatch(
              view.state.tr.insertContentAt(pos.pos, {
                type: 'image',
                attrs: { src: localSrc },
              }),
            );
          }
        } catch (err) {
          console.error('拖放图片保存失败:', err);
        }
      };
      reader.readAsArrayBuffer(file);
      return true;
    },
    [itemId],
  );

  const handlePaste = useCallback(
    (view: any, event: ClipboardEvent, _slice: any) => {
      if (!itemId) return false;

      const items = event.clipboardData?.items;
      if (!items) return false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = async () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const arr = Array.from(new Uint8Array(arrayBuffer));
            try {
              const localSrc = await window.api.editor.saveImageBuffer(itemId, arr, file.type);
              view.dispatch(
                view.state.tr.insertContent({
                  type: 'image',
                  attrs: { src: localSrc },
                }),
              );
            } catch (err) {
              console.error('粘贴图片保存失败:', err);
            }
          };
          reader.readAsArrayBuffer(file);
          return true;
        }
      }
      return false;
    },
    [itemId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'rounded-lg bg-gray-900 p-4 font-mono text-sm text-gray-100',
        },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: 'max-w-full rounded-lg',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Superscript,
      Subscript,
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      if (onChange) {
        onChange(e.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
      handleDrop: readOnly ? undefined : handleDrop,
      handlePaste: readOnly ? undefined : handlePaste,
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  if (readOnly) {
    return (
      <div className="tiptap-preview prose prose-sm max-w-none">
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className={`tiptap-editor mx-auto w-full ${widthClasses[widthMode]} transition-all duration-200`}>
      <div className="rounded-lg border border-gray-200 bg-white">
        <EditorToolbar
          editor={editor}
          itemId={itemId}
          widthMode={widthMode}
          onWidthModeChange={onWidthModeChange}
          onHtmlEdit={onHtmlEdit}
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default TipTapEditor;
