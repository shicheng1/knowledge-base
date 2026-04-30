import { registerItemHandlers } from './item.ipc';
import { registerFolderHandlers } from './folder.ipc';
import { registerTagHandlers } from './tag.ipc';
import { registerSettingsHandlers } from './settings.ipc';
import { registerFileHandlers } from './file.ipc';
import { registerShellHandlers } from './shell.ipc';
import { registerIntegrationHandlers } from './integration.ipc';
import { registerShortcutHandlers } from './shortcut.ipc';
import { registerImportHandlers } from './import.ipc';
import { registerEditorHandlers } from './editor.ipc';
import { registerSyncHandlers } from './sync.ipc';
import { registerArchiveHandlers } from './archive.ipc';

export function registerIpcHandlers(): void {
  registerItemHandlers();
  registerFolderHandlers();
  registerTagHandlers();
  registerSettingsHandlers();
  registerFileHandlers();
  registerShellHandlers();
  registerIntegrationHandlers();
  registerShortcutHandlers();
  registerImportHandlers();
  registerEditorHandlers();
  registerSyncHandlers();
  registerArchiveHandlers();
}
