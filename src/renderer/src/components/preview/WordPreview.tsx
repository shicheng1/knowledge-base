import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface WordPreviewProps {
  filePath: string;
  onOpenExternal?: () => void;
}

const WordPreview: React.FC<WordPreviewProps> = ({ filePath, onOpenExternal }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDocx = async () => {
      if (!filePath || !containerRef.current) return;

      setLoading(true);
      setError(null);

      try {
        const buffer = await window.api.file.readFileAsBuffer(filePath);
        if (cancelled) return;

        const arrayBuffer = new Uint8Array(buffer).buffer;

        const docxPreview = await import('docx-preview');
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        await docxPreview.renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        if (!cancelled) setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? '文档加载失败');
          setLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <p className="mb-4 text-sm text-red-500">文档预览失败: {error}</p>
        {onOpenExternal && (
          <button
            type="button"
            onClick={onOpenExternal}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            用 Office 打开
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">正在加载文档...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="word-preview-container max-h-[700px] overflow-auto rounded-lg bg-white"
      />
    </div>
  );
};

export default WordPreview;
