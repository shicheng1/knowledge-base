import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  children?: Folder[];
  created_at?: string;
  updated_at?: string;
}

interface FolderState {
  folderTree: Folder[];
  currentFolder: Folder | null;
  loading: boolean;
  error: string | null;

  fetchTree: () => Promise<void>;
  fetchFolder: (id: number) => Promise<void>;
  createFolder: (data: any) => Promise<Folder | null>;
  updateFolder: (id: number, data: any) => Promise<Folder | null>;
  deleteFolder: (id: number) => Promise<boolean>;
  moveFolder: (id: number, newParentId: number | null) => Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */
export const useFolderStore = create<FolderState>((set, get) => ({
  folderTree: [],
  currentFolder: null,
  loading: false,
  error: null,

  fetchTree: async () => {
    set({ loading: true, error: null });
    try {
      const tree = await window.api.folder.getTree();
      set({ folderTree: tree ?? [], loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '获取文件夹树失败', loading: false });
    }
  },

  fetchFolder: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const folder = await window.api.folder.getById(id);
      set({ currentFolder: folder, loading: false });
    } catch (err: any) {
      set({ error: err?.message ?? '获取文件夹详情失败', loading: false });
    }
  },

  createFolder: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const folder = await window.api.folder.create(data);
      // 重新加载树以获取最新结构
      await get().fetchTree();
      set({ loading: false });
      return folder;
    } catch (err: any) {
      set({ error: err?.message ?? '创建文件夹失败', loading: false });
      return null;
    }
  },

  updateFolder: async (id: number, data: any) => {
    set({ loading: true, error: null });
    try {
      const updated = await window.api.folder.update(id, data);
      // 重新加载树
      await get().fetchTree();
      set((state) => ({
        currentFolder:
          state.currentFolder?.id === id
            ? { ...state.currentFolder, ...updated }
            : state.currentFolder,
        loading: false,
      }));
      return updated;
    } catch (err: any) {
      set({ error: err?.message ?? '更新文件夹失败', loading: false });
      return null;
    }
  },

  deleteFolder: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await window.api.folder.delete(id);
      // 重新加载树
      await get().fetchTree();
      set((state) => ({
        currentFolder: state.currentFolder?.id === id ? null : state.currentFolder,
        loading: false,
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message ?? '删除文件夹失败', loading: false });
      return false;
    }
  },

  moveFolder: async (id: number, newParentId: number | null) => {
    set({ loading: true, error: null });
    try {
      await window.api.folder.move(id, newParentId);
      // 重新加载树
      await get().fetchTree();
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err?.message ?? '移动文件夹失败', loading: false });
      return false;
    }
  },
}));
