import { ipcMain } from 'electron';
import {
  testWebDavConnection,
  backupToWebDav,
  listWebDavBackups,
  downloadWebDavBackup,
  pushToGit,
  testGitConfig,
  getSyncStatus,
  setWebDavConfig,
  setGitConfig,
} from '../services/webdav-sync.service';
import type { IpcResult } from '../database/types';

const wrap = <T>(fn: () => Promise<T>): Promise<IpcResult<T>> =>
  fn()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => ({ success: false as const, error: err instanceof Error ? err.message : String(err) }));

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:getStatus', () => wrap(async () => getSyncStatus()));

  ipcMain.handle('sync:saveWebdavConfig', (_e, cfg: any) =>
    wrap(async () => {
      setWebDavConfig(cfg);
      return true;
    }),
  );

  ipcMain.handle('sync:webdavTest', (_e, cfg?: any) => wrap(() => testWebDavConnection(cfg ?? getSyncStatus().webdav.config)));

  ipcMain.handle('sync:webdavBackup', (_e, cfg?: any) => wrap(() => backupToWebDav(cfg)));

  ipcMain.handle('sync:webdavList', (_e, cfg?: any) => wrap(() => listWebDavBackups(cfg)));

  ipcMain.handle('sync:webdavDownload', (_e, fileName: string, cfg?: any) =>
    wrap(() => downloadWebDavBackup(fileName, cfg)),
  );

  ipcMain.handle('sync:saveGitConfig', (_e, cfg: any) =>
    wrap(async () => {
      setGitConfig(cfg);
      return true;
    }),
  );

  ipcMain.handle('sync:gitTest', (_e, cfg: any) => wrap(() => testGitConfig(cfg)));

  ipcMain.handle('sync:gitPush', (_e, cfg?: any) => wrap(() => pushToGit(cfg)));
}
