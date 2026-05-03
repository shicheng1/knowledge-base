import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomeView from './views/HomeView';
import FolderView from './views/FolderView';
import ItemDetailView from './views/ItemDetailView';
import SearchView from './views/SearchView';
import SettingsView from './views/SettingsView';
import TrashView from './views/TrashView';
import StatsView from './views/StatsView';
import QuickCaptureView from './views/QuickCaptureView';
import GraphView from './views/GraphView';
import DailyNoteView from './views/DailyNoteView';
import TodoView from './views/TodoView';
import FeedView from './views/FeedView';

const App: React.FC = () => {
  return (
      <HashRouter>
        <Routes>
          {/* Quick capture standalone (no layout) */}
          <Route path="/quick-capture" element={<QuickCaptureView />} />
          {/* Main layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomeView />} />
            <Route path="folder/:id" element={<FolderView />} />
            <Route path="item/:id" element={<ItemDetailView />} />
            <Route path="search" element={<SearchView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="favorites" element={<HomeView favoriteOnly />} />
            <Route path="trash" element={<TrashView />} />
            <Route path="stats" element={<StatsView />} />
            <Route path="graph" element={<GraphView />} />
            <Route path="daily" element={<DailyNoteView />} />
            <Route path="daily/:date" element={<DailyNoteView />} />
            <Route path="todos" element={<TodoView />} />
            <Route path="feed" element={<FeedView />} />
          </Route>
        </Routes>
      </HashRouter>
  );
};

export default App;
