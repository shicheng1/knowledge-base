import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

const initMermaid = () => {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  });
  mermaidInitialized = true;
};

interface MermaidBlockProps {
  code: string;
}

const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    initMermaid();
    let cancelled = false;
    const render = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? '渲染失败');
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="rounded bg-red-50 p-3 text-xs text-red-600 whitespace-pre-wrap">
        Mermaid 渲染错误: {error}
        {'\n'}
        {code}
      </pre>
    );
  }

  return <div ref={ref} className="my-3 flex justify-center overflow-x-auto" />;
};

export default MermaidBlock;
