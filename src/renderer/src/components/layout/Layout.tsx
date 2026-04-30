import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CommandPalette from '../global/CommandPalette';

const Layout: React.FC = () => {
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

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </div>
      </main>

      <CommandPalette />
    </div>
  );
};

export default Layout;
