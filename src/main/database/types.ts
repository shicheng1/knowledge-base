// ============================================================
// Database Types - Personal Knowledge Base
// ============================================================

/** Folder entity */
export interface Folder {
  id: number;
  parentId: number | null;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Tag entity */
export interface Tag {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
}

/** Content type for knowledge items */
export type ContentType =
  | 'note'
  | 'article'
  | 'bookmark'
  | 'file'
  | 'code'
  | 'image'
  | 'other';

/** Source type indicating how the item was added */
export type SourceType =
  | 'web'
  | 'file'
  | 'clipboard'
  | 'api'
  | 'import'
  | 'manual'
  | 'rss'
  | 'github';

/** Item entity */
export interface Item {
  id: number;
  title: string;
  content: string | null;
  contentHtml: string | null;
  summary: string | null;
  contentType: ContentType;
  sourceUrl: string | null;
  sourceType: SourceType;
  sourceName: string | null;
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  folderId: number | null;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned: boolean;
  isTemplate: boolean;
  templateCategory: string | null;
  metadata: string | null; // JSON string
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Tags associated with this item (joined from query) */
  tags?: Tag[];
}

/** Attachment entity */
export interface Attachment {
  id: number;
  itemId: number;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  sortOrder: number;
  createdAt: string;
}

/** Setting entity */
export interface Setting {
  keyName: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  updatedAt: string;
}

/** Item link entity (bidirectional linking) */
export interface ItemLink {
  id: number;
  sourceItemId: number;
  targetItemId: number;
  linkText: string | null;
  createdAt: string;
  /** The linked item's detail (joined in query) */
  targetItem?: {
    id: number;
    title: string;
    contentType: ContentType;
    deletedAt: string | null;
  };
  sourceItem?: {
    id: number;
    title: string;
    contentType: ContentType;
    deletedAt: string | null;
  };
}

// ============================================================
// DTOs (Data Transfer Objects)
// ============================================================

/** DTO for creating a new item */
export interface CreateItemDTO {
  title: string;
  content?: string | null;
  contentHtml?: string | null;
  summary?: string | null;
  contentType: ContentType;
  sourceUrl?: string | null;
  sourceType?: SourceType;
  sourceName?: string | null;
  filePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  folderId?: number | null;
  isFavorite?: boolean;
  isArchived?: boolean;
  isTemplate?: boolean;
  templateCategory?: string | null;
  metadata?: Record<string, unknown> | null;
  tagIds?: number[];
}

/** DTO for updating an existing item */
export interface UpdateItemDTO {
  title?: string;
  content?: string | null;
  contentHtml?: string | null;
  summary?: string | null;
  contentType?: ContentType;
  sourceUrl?: string | null;
  sourceType?: SourceType;
  sourceName?: string | null;
  filePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  folderId?: number | null;
  isFavorite?: boolean;
  isArchived?: boolean;
  isTemplate?: boolean;
  templateCategory?: string | null;
  metadata?: Record<string, unknown> | null;
  tagIds?: number[];
}

/** DTO for creating a new folder */
export interface CreateFolderDTO {
  name: string;
  parentId?: number | null;
  description?: string | null;
  sortOrder?: number;
}

/** DTO for updating an existing folder */
export interface UpdateFolderDTO {
  name?: string;
  parentId?: number | null;
  description?: string | null;
  sortOrder?: number;
}

/** DTO for creating a new attachment */
export interface CreateAttachmentDTO {
  itemId: number;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  sortOrder?: number;
}

/** DTO for updating an existing tag */
export interface UpdateTagDTO {
  name?: string;
  color?: string | null;
}

// ============================================================
// Query Options & Pagination
// ============================================================

/** Sorting configuration */
export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

/** Date range filter */
export interface DateRange {
  start: string;
  end: string;
}

/** Query options for listing items */
export interface QueryOptions {
  page?: number;
  pageSize?: number;
  folderId?: number | null;
  contentType?: ContentType;
  isFavorite?: boolean;
  isArchived?: boolean;
  dateRange?: DateRange;
  tagId?: number;
  sort?: SortOptions;
  keyword?: string;
  includeDeleted?: boolean;
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// Folder tree structure
// ============================================================

/** Folder node with children for tree representation */
export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

// ============================================================
// Statistics
// ============================================================

/** Item statistics */
export interface ItemStats {
  total: number;
  byType: Record<ContentType, number>;
  favorites: number;
  archived: number;
  recentItems: Item[];
}

// ============================================================
// Error types
// ============================================================

/** Standard error result returned from IPC handlers */
export interface ErrorResult {
  success: false;
  error: string;
  code?: string;
}

/** Standard success result returned from IPC handlers */
export interface SuccessResult<T = unknown> {
  success: true;
  data: T;
}

/** Union type for IPC handler results */
export type IpcResult<T = unknown> = SuccessResult<T> | ErrorResult;

// ============================================================
// Feed Sources & Feed Items
// ============================================================

export type FeedSourceType = 'rss' | 'github';

export interface FeedSource {
  id: number;
  name: string;
  url: string;
  type: FeedSourceType;
  description: string | null;
  iconUrl: string | null;
  siteUrl: string | null;
  category: string | null;
  enabled: boolean;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
  failCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem {
  id: number;
  sourceId: number;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  contentHash: string | null;
  importedItemId: number | null;
  metadata: string | null;
  isRead: boolean;
  createdAt: string;
  source?: FeedSource;
}

export interface CreateFeedSourceDTO {
  name: string;
  url: string;
  type: FeedSourceType;
  description?: string | null;
  iconUrl?: string | null;
  siteUrl?: string | null;
  category?: string | null;
  enabled?: boolean;
  fetchIntervalMinutes?: number;
}

export interface UpdateFeedSourceDTO {
  name?: string;
  url?: string;
  description?: string | null;
  iconUrl?: string | null;
  siteUrl?: string | null;
  category?: string | null;
  enabled?: boolean;
  fetchIntervalMinutes?: number;
}

export interface FeedQueryOptions {
  page?: number;
  pageSize?: number;
  sourceId?: number | null;
  sourceType?: FeedSourceType | null;
  keyword?: string;
  importedOnly?: boolean;
  unimportedOnly?: boolean;
}

export interface PresetFeedSource {
  name: string;
  url: string;
  description: string;
  siteUrl: string;
  category?: string;
}
