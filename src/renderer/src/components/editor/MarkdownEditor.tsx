import React, { useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import { search } from '@codemirror/search';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import MarkdownToolbar from './MarkdownToolbar';
import { Edit3, Columns, Eye } from 'lucide-react';

export interface MarkdownEditorHandle {
  insertText: (text: string) => void;
  replaceSelection: (text: string) => void;
  focus: () => void;
}

interface MarkdownEditorProps {
  content: string;
  onChange?: (value: string) => void;
  viewMode?: 'split' | 'edit' | 'preview';
  onViewModeChange?: (mode: 'split' | 'edit' | 'preview') => void;
  placeholder?: string;
  itemId?: number;
}

const formatActions: Record<string, { before: string; after: string; placeholder?: string }> = {
  h1: { before: '# ', after: '' },
  h2: { before: '## ', after: '' },
  h3: { before: '### ', after: '' },
  bold: { before: '**', after: '**', placeholder: '粗体文本' },
  italic: { before: '*', after: '*', placeholder: '斜体文本' },
  strikethrough: { before: '~~', after: '~~', placeholder: '删除线文本' },
  quote: { before: '> ', after: '' },
  code: { before: '`', after: '`', placeholder: '代码' },
  codeblock: { before: '```\n', after: '\n```' },
  link: { before: '[', after: '](url)', placeholder: '链接文本' },
  ul: { before: '- ', after: '' },
  ol: { before: '1. ', after: '' },
  task: { before: '- [ ] ', after: '' },
  table: { before: '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| ', after: ' | | |' },
  hr: { before: '\n---\n', after: '' },
};

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ content, onChange, viewMode = 'split', onViewModeChange, placeholder = '输入 Markdown 内容...', itemId }, ref) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [splitRatio, setSplitRatio] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    const insertMarkdownImage = useCallback((localSrc: string, altText?: string) => {
      const view = editorRef.current?.view;
      if (!view) return;
      const mdImage = `![${altText || '图片'}](${localSrc})`;
      const cursor = view.state.selection.main.head;
      view.dispatch({ changes: { from: cursor, insert: mdImage } });
      view.focus();
    }, []);

    const saveImageFromArrayBuffer = useCallback(async (arrayBuffer: ArrayBuffer, mimeType: string) => {
      if (!itemId) return;
      const arr = Array.from(new Uint8Array(arrayBuffer));
      try {
        const localSrc = await window.api.editor.saveImageBuffer(itemId, arr, mimeType);
        insertMarkdownImage(localSrc);
      } catch (err) {
        console.error('图片保存失败:', err);
      }
    }, [itemId, insertMarkdownImage]);

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        const view = editorRef.current?.view;
        if (view) {
          const cursor = view.state.selection.main.head;
          view.dispatch({ changes: { from: cursor, insert: text } });
        }
      },
      replaceSelection: (text: string) => {
        const view = editorRef.current?.view;
        if (view) {
          const { from, to } = view.state.selection.main;
          view.dispatch({ changes: { from, to, insert: text } });
        }
      },
      focus: () => {
        const view = editorRef.current?.view;
        if (view) view.focus();
      },
    }));

    const handleFormat = useCallback((type: string) => {
      const view = editorRef.current?.view;
      if (!view) return;

      if (type === 'image') {
        if (itemId) {
          window.api.editor.selectImage(itemId).then((result) => {
            if (result?.localSrc) {
              insertMarkdownImage(result.localSrc);
            }
          }).catch((err) => {
            console.error('选择图片失败:', err);
          });
        } else {
          const format = formatActions.image;
          const { from, to } = view.state.selection.main;
          const selectedText = view.state.sliceDoc(from, to);
          const text = selectedText
            ? format.before + selectedText + format.after
            : format.before + (format.placeholder || '') + format.after;
          view.dispatch({ changes: { from, to, insert: text } });
          view.focus();
        }
        return;
      }

      const format = formatActions[type];
      if (!format) return;

      const { from, to } = view.state.selection.main;
      const selectedText = view.state.sliceDoc(from, to);
      const text = selectedText
        ? format.before + selectedText + format.after
        : format.before + (format.placeholder || '') + format.after;

      view.dispatch({ changes: { from, to, insert: text } });
      view.focus();
    }, [itemId, insertMarkdownImage]);

    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        const container = document.querySelector('.md-editor-split');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const ratio = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitRatio(Math.min(80, Math.max(20, ratio)));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
    }, []);

    const handleChange = useCallback(
      (val: string) => {
        if (onChange) onChange(val);
      },
      [onChange],
    );

    const editorExtensions = useCallback(() => {
      const exts: any[] = [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        search(),
      ];

      if (itemId) {
        exts.push(
          EditorView.domEventHandlers({
            drop: (event: DragEvent) => {
              if (!event.dataTransfer?.files.length) return false;
              const file = event.dataTransfer.files[0];
              if (!file.type.startsWith('image/')) return false;
              event.preventDefault();
              const reader = new FileReader();
              reader.onload = async () => {
                const arrayBuffer = reader.result as ArrayBuffer;
                await saveImageFromArrayBuffer(arrayBuffer, file.type);
              };
              reader.readAsArrayBuffer(file);
              return true;
            },
            paste: (event: ClipboardEvent) => {
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
                    await saveImageFromArrayBuffer(arrayBuffer, file.type);
                  };
                  reader.readAsArrayBuffer(file);
                  return true;
                }
              }
              return false;
            },
          }),
        );
      }

      return exts;
    }, [itemId, saveImageFromArrayBuffer]);

    return (
      <div className="flex flex-col rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50">
          <MarkdownToolbar onFormat={handleFormat} />
          {onViewModeChange && (
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-white p-0.5 mr-2">
              <button
                type="button"
                onClick={() => onViewModeChange('edit')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'edit' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="仅编辑"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('split')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'split' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="分屏预览"
              >
                <Columns className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('preview')}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'preview' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                title="仅预览"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="md-editor-split flex">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div
              className={viewMode === 'split' ? '' : 'w-full'}
              style={viewMode === 'split' ? { width: `${splitRatio}%` } : undefined}
            >
              <CodeMirror
                ref={editorRef}
                value={content}
                onChange={handleChange}
                theme={githubLight}
                extensions={editorExtensions()}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                  autocompletion: false,
                  bracketMatching: true,
                  closeBrackets: true,
                  indentOnInput: true,
                  searchKeymap: false,
                }}
                placeholder={placeholder}
                className="md-codemirror-editor"
              />
            </div>
          )}

          {viewMode === 'split' && (
            <div
              className="group relative flex-shrink-0 cursor-col-resize"
              onMouseDown={handleMouseDown}
            >
              <div className={`h-full w-px bg-gray-200 transition-colors group-hover:bg-blue-400 ${isDragging ? 'bg-blue-500' : ''}`} />
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className={`overflow-auto bg-white ${viewMode === 'split' ? '' : 'w-full'}`}
              style={
                viewMode === 'split'
                  ? { width: `${100 - splitRatio}%` }
                  : undefined
              }
            >
              <div className="md-preview-content prose prose-sm max-w-none p-4">
                {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                    components={{
                      a: ({ href, children, ...props }: any) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                          {children}
                        </a>
                      ),
                      img: ({ src, alt, ...props }: any) => (
                        <img src={src} alt={alt || ''} loading="lazy" {...props} />
                      ),
                      table: ({ children, ...props }: any) => (
                        <div className="overflow-x-auto">
                          <table {...props}>{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <p className="text-lg">空白文档</p>
                    <p className="mt-1 text-sm">开始输入 Markdown 内容以预览</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
