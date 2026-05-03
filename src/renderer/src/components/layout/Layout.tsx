import React, { useRef, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from '../global/CommandPalette';

const Layout: React.FC = () => {
  const mainRef = useRef<HTMLElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex h-screen bg-gray-50"
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      <aside className="w-[260px] flex-shrink-0 border-r border-gray-200 bg-white">
        <Sidebar />
      </aside>

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </div>
      </main>

      {showScrollTop && (
        <button
          type="button"
          onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
          title="回到顶部"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      <CommandPalette />
    </div>
  );
};

export default Layout;
