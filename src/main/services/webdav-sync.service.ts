import Store from 'electron-store';
import { dialog } from 'electron';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import { createClient, type WebDAVClient } from 'webdav';
import { itemRepo } from '../database/repositories/item.repo';
import { tagRepo } from '../database/repositories/tag.repo';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

interface SyncStore {
  webdav: WebDavConfig;
  webdavLastSyncAt: string | null;
  git: GitConfig;
  gitLastSyncAt: string | null;
}

interface GitConfig {
  remoteUrl: string;
  branch: string;
  username: string;
  token: string;
  authorEmail: string;
  authorName: string;
}

const syncStore = new Store<SyncStore>({
  name: 'sync-config',
  defaults: {
    webdav: { url: '', username: '', password: '', remotePath: '/knowledge-base' },
    webdavLastSyncAt: null,
    git: { remoteUrl: '', branch: 'main', username: '', token: '', authorEmail: '', authorName: 'KnowledgeBase' },
    gitLastSyncAt: null,
  },
});

export const getWebDavConfig = (): WebDavConfig => syncStore.get('webdav') as WebDavConfig;
export const setWebDavConfig = (config: WebDavConfig): void => syncStore.set('webdav', config);
export const getWebDavLastSync = (): string | null => syncStore.get('webdavLastSyncAt');

export const getGitConfig = (): GitConfig => syncStore.get('git') as GitConfig;
export const setGitConfig = (config: GitConfig): void => syncStore.set('git', config);
export const getGitLastSync = (): string | null => syncStore.get('gitLastSyncAt');

const buildClient = (cfg: WebDavConfig): WebDAVClient => {
  if (!cfg.url) throw new Error('WebDAV URL 未配置');
  return createClient(cfg.url, {
    username: cfg.username,
    password: cfg.password,
  });
};

const sanitize = (name: string): string =>
  name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 200) || 'unnamed';

const findAllFolders = async (): Promise<any[]> => {
  const rows = await query(`SELECT * FROM folders ORDER BY parent_id, name`, []);
  return Array.isArray(rows) ? (rows as any[]) : [];
};

/**
 * 构建包含整库的 zip 数据。
 */
const buildExportZip = async (): Promise<Buffer> => {
  const zip = new JSZip();

  const folders = await findAllFolders();
  const tags = await tagRepo.findAll();
  const itemsResult = await itemRepo.findAll({ page: 1, pageSize: 100000 });
  const items = itemsResult.data;

  zip.file(
    'metadata.json',
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        folders,
        tags,
        items: items.map((it: any) => ({
          id: it.id,
          title: it.title,
          contentType: it.content_type,
          sourceUrl: it.source_url,
          folderId: it.folder_id,
          tags: (it.tags ?? []).map((t: any) => t.name),
          createdAt: it.created_at,
          updatedAt: it.updated_at,
        })),
      },
      null,
      2,
    ),
  );

  for (const item of items) {
    const baseName = sanitize(`${item.id}-${item.title}`);
    zip.file(`items/${baseName}.md`, item.content ?? '');
    zip.file(
      `items/${baseName}.json`,
      JSON.stringify(item, null, 2),
    );
  }

  return await zip.generateAsync({ type: 'nodebuffer' });
};

export const testWebDavConnection = async (cfg: WebDavConfig): Promise<boolean> => {
  const client = buildClient(cfg);
  // exists() 返回 true/false 即视为通
  await client.exists('/');
  return true;
};

export const backupToWebDav = async (
  cfg?: Partial<WebDavConfig>,
): Promise<{ remoteFile: string; size: number }> => {
  const merged = { ...getWebDavConfig(), ...cfg };
  if (!merged.url) throw new Error('WebDAV URL 未配置');
  const client = buildClient(merged);
  const remoteDir = merged.remotePath || '/knowledge-base';

  if (!(await client.exists(remoteDir))) {
    await client.createDirectory(remoteDir, { recursive: true } as any);
  }

  const buf = await buildExportZip();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const remoteFile = `${remoteDir}/backup-${stamp}.zip`;
  await client.putFileContents(remoteFile, buf, { overwrite: true });

  syncStore.set('webdavLastSyncAt', new Date().toISOString());
  logger.info(`WebDAV 备份完成: ${remoteFile}`);
  return { remoteFile, size: buf.length };
};

export const listWebDavBackups = async (
  cfg?: Partial<WebDavConfig>,
): Promise<Array<{ name: string; size: number; lastModified: string }>> => {
  const merged = { ...getWebDavConfig(), ...cfg };
  const client = buildClient(merged);
  const remoteDir = merged.remotePath || '/knowledge-base';
  if (!(await client.exists(remoteDir))) return [];
  const items = (await client.getDirectoryContents(remoteDir)) as any[];
  return items
    .filter((i) => i.type === 'file' && i.basename.endsWith('.zip'))
    .map((i) => ({ name: i.basename, size: i.size, lastModified: i.lastmod }));
};

export const downloadWebDavBackup = async (
  fileName: string,
  cfg?: Partial<WebDavConfig>,
): Promise<{ localPath: string }> => {
  const merged = { ...getWebDavConfig(), ...cfg };
  const client = buildClient(merged);
  const remoteDir = merged.remotePath || '/knowledge-base';
  const remoteFile = `${remoteDir}/${fileName}`;
  const buf = (await client.getFileContents(remoteFile)) as Buffer;

  const result = await dialog.showSaveDialog({
    title: '保存备份到本地',
    defaultPath: fileName,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) {
    throw new Error('用户取消');
  }
  writeFileSync(result.filePath, buf);
  return { localPath: result.filePath };
};

/* ================================================================== */
/*  Git Sync (isomorphic-git)                                          */
/* ================================================================== */

const getGitWorkdir = (): string => {
  const home = os.homedir();
  return path.join(home, '.knowledgebase-git');
};

const ensureGitWorkdir = (): string => {
  const dir = getGitWorkdir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
};

const writeRepoFiles = async (dir: string): Promise<void> => {
  const folders = await findAllFolders();
  const folderMap = new Map<number, string>();
  const buildPath = (id: number | null): string => {
    if (id === null) return '';
    const cached = folderMap.get(id);
    if (cached) return cached;
    const folder = folders.find((f: any) => f.id === id);
    if (!folder) return '';
    const parent = folder.parent_id ? buildPath(folder.parent_id) : '';
    const segment = sanitize(folder.name);
    const full = parent ? `${parent}/${segment}` : segment;
    folderMap.set(id, full);
    return full;
  };

  const itemsResult = await itemRepo.findAll({ page: 1, pageSize: 100000 });
  const items = itemsResult.data;

  // 清理 items 目录（保守：仅基于 id 的固定文件名）
  for (const item of items) {
    const folderPath = item.folder_id ? buildPath(item.folder_id) : '';
    const targetDir = path.join(dir, 'notes', folderPath);
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const fileName = `${item.id}-${sanitize(item.title)}.md`;
    const frontmatter = [
      '---',
      `id: ${item.id}`,
      `title: ${JSON.stringify(item.title)}`,
      `content_type: ${item.content_type}`,
      item.source_url ? `source_url: ${item.source_url}` : '',
      item.tags?.length ? `tags: [${item.tags.map((t: any) => JSON.stringify(t.name)).join(', ')}]` : '',
      `created_at: ${item.created_at}`,
      `updated_at: ${item.updated_at}`,
      '---',
      '',
    ]
      .filter(Boolean)
      .join('\n');
    writeFileSync(path.join(targetDir, fileName), frontmatter + (item.content ?? ''), 'utf-8');
  }

  writeFileSync(
    path.join(dir, 'README.md'),
    `# Knowledge Base Sync\n\n最后同步：${new Date().toISOString()}\n条目数：${items.length}\n`,
    'utf-8',
  );
};

export const testGitConfig = async (cfg: GitConfig): Promise<boolean> => {
  if (!cfg.remoteUrl) throw new Error('Git 仓库 URL 未配置');
  return true;
};

export const pushToGit = async (cfg?: Partial<GitConfig>): Promise<{ commitOid: string; pushed: boolean }> => {
  const merged = { ...getGitConfig(), ...cfg };
  if (!merged.remoteUrl) throw new Error('Git 仓库 URL 未配置');

  const dir = ensureGitWorkdir();
  const fs = await import('fs');
  const http = await import('isomorphic-git/http/node');
  const git = (await import('isomorphic-git')).default;

  const gitDir = path.join(dir, '.git');
  if (!existsSync(gitDir)) {
    await git.init({ fs, dir, defaultBranch: merged.branch || 'main' });
    try {
      await git.addRemote({ fs, dir, remote: 'origin', url: merged.remoteUrl });
    } catch {}
  }

  await writeRepoFiles(dir);

  await git.add({ fs, dir, filepath: '.' });
  const commitOid = await git.commit({
    fs,
    dir,
    message: `sync: ${new Date().toISOString()}`,
    author: {
      name: merged.authorName || 'KnowledgeBase',
      email: merged.authorEmail || 'kb@example.com',
    },
  });

  let pushed = false;
  try {
    await git.push({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: merged.branch || 'main',
      onAuth: () => ({ username: merged.username || merged.token, password: merged.token }),
      force: true,
    });
    pushed = true;
  } catch (err) {
    logger.warn('Git push 失败:', err);
  }

  syncStore.set('gitLastSyncAt', new Date().toISOString());
  return { commitOid, pushed };
};

export const getSyncStatus = () => ({
  webdav: { config: getWebDavConfig(), lastSyncAt: getWebDavLastSync() },
  git: { config: getGitConfig(), lastSyncAt: getGitLastSync() },
});
