import React, { useCallback, useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import { search } from '@codemirror/search';
import ReactMarkdown from 'react-markdown';
import { markdownUrlTransform } from '../../markdown/urlTransform';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import MarkdownToolbar from './MarkdownToolbar';
import MermaidBlock from './MermaidBlock';
import { Edit3, Columns, Eye } from 'lucide-react';

const countWords = (text: string): { chars: number; words: number; minutes: number } => {
  const chars = text.length;
  const cnChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const enWords = (text.match(/[A-Za-z]+/g) || []).length;
  const minutes = Math.max(1, Math.ceil(cnChars / 300 + enWords / 200));
  return { chars, words: cnChars + enWords, minutes };
};

export interface MarkdownEditorHandle {
  insertText: (text: string) => void;
  replaceSelection: (text: string) => void;
  focus: () => void;
  scrollToLine: (line: number) => void;
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
    const previewRef = useRef<HTMLDivElement>(null);
    const syncingRef = useRef<'editor' | 'preview' | null>(null);
    const [splitRatio, setSplitRatio] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const stats = useMemo(() => countWords(content || ''), [content]);

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
      scrollToLine: (line: number) => {
        const view = editorRef.current?.view;
        if (!view) return;
        const safeLine = Math.max(1, Math.min(view.state.doc.lines, line));
        const lineInfo = view.state.doc.line(safeLine);
        view.dispatch({
          selection: { anchor: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start' }),
        });
        view.focus();
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
        EditorView.domEventHandlers({
          scroll: (_event, view) => {
            if (syncingRef.current === 'preview') {
              syncingRef.current = null;
              return false;
            }
            const preview = previewRef.current;
            if (!preview) return false;
            const editorScroll = view.scrollDOM;
            const ratio =
              editorScroll.scrollTop /
              Math.max(1, editorScroll.scrollHeight - editorScroll.clientHeight);
            syncingRef.current = 'editor';
            preview.scrollTop = ratio * Math.max(0, preview.scrollHeight - preview.clientHeight);
            return false;
          },
        }),
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
              ref={previewRef}
              className={`overflow-auto bg-white ${viewMode === 'split' ? '' : 'w-full'}`}
              style={
                viewMode === 'split'
                  ? { width: `${100 - splitRatio}%` }
                  : undefined
              }
              onScroll={() => {
                if (viewMode !== 'split') return;
                if (syncingRef.current === 'editor') {
                  syncingRef.current = null;
                  return;
                }
                const view = editorRef.current?.view;
                const preview = previewRef.current;
                if (!view || !preview) return;
                const ratio =
                  preview.scrollTop / Math.max(1, preview.scrollHeight - preview.clientHeight);
                const editorScroll = view.scrollDOM;
                syncingRef.current = 'preview';
                editorScroll.scrollTop =
                  ratio * Math.max(0, editorScroll.scrollHeight - editorScroll.clientHeight);
              }}
            >
              <div className="md-preview-content prose prose-sm max-w-none p-4">
                {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
                    urlTransform={markdownUrlTransform}
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
                      code: ({ inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match?.[1];
                        const codeText = String(children).replace(/\n$/, '');
                        if (!inline && lang === 'mermaid') {
                          return <MermaidBlock code={codeText} />;
                        }
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
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

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-3 py-1 text-xs text-gray-500">
          <span>字符 {stats.chars}</span>
          <span>字数 {stats.words}</span>
          <span>阅读约 {stats.minutes} 分钟</span>
        </div>
      </div>
    );
  },
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
