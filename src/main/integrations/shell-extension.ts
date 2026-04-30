import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { logger } from '../utils/logger'

const execAsync = promisify(exec)

// ---------------------------------------------------------------------------
// Registry paths (HKCU, no admin required)
// ---------------------------------------------------------------------------

const REG_FILE = 'HKCU\\SOFTWARE\\Classes\\*\\shell\\SaveToKnowledgeBase'
const REG_DIR = 'HKCU\\SOFTWARE\\Classes\\Directory\\shell\\SaveToKnowledgeBase'
const REG_BG = 'HKCU\\SOFTWARE\\Classes\\Directory\\Background\\shell\\SaveToKnowledgeBase'

const MENU_LABEL = '\u4FDD\u5B58\u5230\u77E5\u8BC6\u5E93' // 保存到知识库

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register Windows Explorer right-click context menu entries.
 * Creates a .reg file and imports it to avoid all quoting/escaping issues.
 */
export async function registerShellMenu(appPath: string): Promise<void> {
    try {
        // .reg 文件中路径的反斜杠需要双写
        const escapedPath = appPath.replace(/\\/g, '\\\\')

        // Build .reg file content - Windows Registry Editor format
        const regContent = `Windows Registry Editor Version 5.00

; File right-click menu
[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\*\\shell\\SaveToKnowledgeBase]
@="${MENU_LABEL}"
"Icon"="${escapedPath},0"

[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\*\\shell\\SaveToKnowledgeBase\\command]
@="\\"${escapedPath}\\" --save-file \\"%1\\""

; Directory right-click menu
[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\Directory\\shell\\SaveToKnowledgeBase]
@="${MENU_LABEL}"
"Icon"="${escapedPath},0"

[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\Directory\\shell\\SaveToKnowledgeBase\\command]
@="\\"${escapedPath}\\" --save-file \\"%1\\""

; Directory background right-click menu
[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\Directory\\Background\\shell\\SaveToKnowledgeBase]
@="${MENU_LABEL}"
"Icon"="${escapedPath},0"

[HKEY_CURRENT_USER\\SOFTWARE\\Classes\\Directory\\Background\\shell\\SaveToKnowledgeBase\\command]
@="\\"${escapedPath}\\" --save-file \\"%V\\""
`

        // Write .reg file to temp directory (UTF-16LE with BOM)
        const tmpDir = app.getPath('temp')
        const regFilePath = path.join(tmpDir, 'knowledge-base-shell-menu.reg')
        const BOM = '\uFEFF'
        await fs.writeFile(regFilePath, BOM + regContent, 'utf16le')

        // Import the .reg file
        await execAsync(`reg import "${regFilePath}"`)

        // Clean up
        try {
            await fs.unlink(regFilePath)
        } catch {
            // ignore cleanup errors
        }

        logger.info('[ShellExtension] Context menu registered successfully via .reg import')
    } catch (err) {
        logger.error('[ShellExtension] Failed to register context menu:', err)
        throw new Error(
            `Failed to register shell context menu: ${err instanceof Error ? err.message : String(err)}`
        )
    }
}

/**
 * Unregister Windows Explorer right-click context menu entries.
 */
export async function unregisterShellMenu(): Promise<void> {
    const keys = [REG_FILE, REG_DIR, REG_BG]

    for (const key of keys) {
        try {
            await execAsync(`reg delete "${key}" /f`)
            logger.info(`[ShellExtension] Removed: ${key}`)
        } catch {
            // Key may not exist, ignore
        }
    }

    logger.info('[ShellExtension] Context menu unregistered')
}

/**
 * Check whether the shell context menu is currently registered.
 */
export async function isShellMenuRegistered(): Promise<boolean> {
    try {
        await execAsync(`reg query "${REG_FILE}"`)
        return true
    } catch {
        return false
    }
}
