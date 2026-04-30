import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
export interface Item {
  id: number;
  title: string;
  content: string;
  summary: string;
  content_type: string;
  source_url: string | null;
  folder_id: number | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  folder_path?: string;
  tags?: TagItem[];
}

export interface TagItem {
  id: number;
  name: string;
  color: string;
}

interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
}

interface ItemState {
  items: Item[];
  currentItem: Item | null;
  loading: boolean;
  error: string | null;
  totalCount: number;

  fetchItems: (options?: any) => Promise<void>;
  fetchItem: (id: number) => Promise<void>;
  createItem: (data: any) => Promise<Item | null>;
  updateItem: (id: number, data: any) => Promise<Item | null>;
  deleteItem: (id: number) => Promise<boolean>;
  searchItems: (keyword: string, options?: any) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  clearCurrent: () => void;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */
export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  currentItem: null,
  loading: false,
  error: null,
  totalCount: 0,

  fetchItems: async (options?: any) => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.item.getList(options);
      const items: Item[] = res?.data ?? res?.items ?? (Array.isArray(res) ? res : []);
      const total: number = res?.total ?? items.length;
      set({ items, totalCount: total, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '获取条目列表失败', loading: false });
    }
  },

  fetchItem: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const item = await window.api.item.getById(id);
      set({ currentItem: item, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '获取条目详情失败', loading: false });
    }
  },

  createItem: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const item = await window.api.item.create(data);
      // 将新条目添加到列表头部
      set((state) => ({
        items: [item, ...state.items],
        totalCount: state.totalCount + 1,
        loading: false,
      }));
      return item;
    } catch (err: any) {
      set({ error: err?.message ?? '创建条目失败', loading: false });
      return null;
    }
  },

  updateItem: async (id: number, data: any) => {
    set({ loading: true, error: null });
    try {
      const updated = await window.api.item.update(id, data);
      // 更新列表中的条目
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, ...updated } : item)),
        currentItem:
          state.currentItem?.id === id
            ? { ...state.currentItem, ...updated }
            : state.currentItem,
        loading: false,
      }));
      return updated;
    } catch (err: any) {
      set({ error: err?.message ?? '更新条目失败', loading: false });
      return null;
    }
  },

  deleteItem: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await window.api.item.delete(id);
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        totalCount: state.totalCount - 1,
        currentItem: state.currentItem?.id === id ? null : state.currentItem,
        loading: false,
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message ?? '删除条目失败', loading: false });
      return false;
    }
  },

  searchItems: async (keyword: string, options?: any) => {
    set({ loading: true, error: null });
    try {
      const res = await window.api.item.search(keyword, options);
      const items: Item[] = res?.data ?? res?.items ?? (Array.isArray(res) ? res : []);
      set({ items, totalCount: items.length, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '搜索失败', loading: false });
    }
  },

  toggleFavorite: async (id: number) => {
    try {
      await window.api.item.toggleFavorite(id);
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, is_favorite: !item.is_favorite } : item,
        ),
        currentItem:
          state.currentItem?.id === id
            ? { ...state.currentItem, is_favorite: !state.currentItem.is_favorite }
            : state.currentItem,
      }));
    } catch (err: any) {
      set({ error: err?.message ?? '切换收藏失败' });
    }
  },

  clearCurrent: () => {
    set({ currentItem: null, error: null });
  },
}));
