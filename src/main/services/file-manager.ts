import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface DirectoryNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: DirectoryNode[]
}

class FileManager {
  private rootPath: string | null = null

  /**
   * Set the root directory for knowledge base storage.
   * Validates the path exists and creates a marker file.
   */
  async setRootDirectory(dirPath: string): Promise<void> {
    const stat = await fs.stat(dirPath).catch(() => null)
    if (!stat || !stat.isDirectory()) {
      throw new Error(`Path does not exist or is not a directory: ${dirPath}`)
    }

    // Create marker file to identify this directory as a knowledge base root
    const markerPath = path.join(dirPath, '.knowledge-base')
    await fs.writeFile(markerPath, JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
    }), 'utf-8')

    this.rootPath = path.resolve(dirPath)
  }

  /**
   * Get the current root directory path.
   */
  getRootDirectory(): string | null {
    return this.rootPath
  }

  /**
   * Create a sub-directory under the root.
   * Supports nested directory creation via recursive mkdir.
   * Returns the full path of the created directory.
   */
  async createSubDirectory(relativePath: string): Promise<string> {
    this.ensureRoot()

    const sanitized = this.sanitizeRelativePath(relativePath)
    const fullPath = path.join(this.rootPath!, sanitized)

    await fs.mkdir(fullPath, { recursive: true })
    return fullPath
  }

  /**
   * Save a file to the specified relative path under root.
   * Creates parent directories if they do not exist.
   * Returns the full path of the saved file.
   */
  async saveFile(relativePath: string, data: Buffer): Promise<string> {
    this.ensureRoot()

    const sanitized = this.sanitizeRelativePath(relativePath)
    const fullPath = path.join(this.rootPath!, sanitized)

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath)
    await fs.mkdir(parentDir, { recursive: true })

    await fs.writeFile(fullPath, data)
    return fullPath
  }

  /**
   * Import (copy) a file from an external source path into storage.
   * Generates a unique filename if a conflict exists.
   * Returns the relative path of the saved file within the knowledge base.
   */
  async importFile(sourcePath: string, targetRelativePath: string): Promise<string> {
    this.ensureRoot()

    // Verify source file exists
    const sourceStat = await fs.stat(sourcePath).catch(() => null)
    if (!sourceStat || !sourceStat.isFile()) {
      throw new Error(`Source file does not exist or is not a file: ${sourcePath}`)
    }

    const sanitized = this.sanitizeRelativePath(targetRelativePath)
    let fullPath = path.join(this.rootPath!, sanitized)

    // Handle filename conflicts by appending a short hash
    if (await this.pathExists(fullPath)) {
      const ext = path.extname(sanitized)
      const baseName = path.basename(sanitized, ext)
      const dir = path.dirname(sanitized)
      const uniqueSuffix = crypto.randomBytes(4).toString('hex')
      const uniqueName = `${baseName}_${uniqueSuffix}${ext}`
      fullPath = path.join(this.rootPath!, dir, uniqueName)
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath)
    await fs.mkdir(parentDir, { recursive: true })

    await fs.copyFile(sourcePath, fullPath)

    // Return relative path from root
    return path.relative(this.rootPath!, fullPath)
  }

  /**
   * Delete a file or empty directory at the given relative path.
   */
  async deleteFile(relativePath: string): Promise<void> {
    this.ensureRoot()

    const sanitized = this.sanitizeRelativePath(relativePath)
    const fullPath = path.join(this.rootPath!, sanitized)

    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat) {
      throw new Error(`File or directory not found: ${relativePath}`)
    }

    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true })
    } else {
      await fs.unlink(fullPath)
    }
  }

  /**
   * Recursively read the directory structure and return a tree.
   * If dirPath is not provided, reads from the root directory.
   */
  async getDirectoryTree(dirPath?: string): Promise<DirectoryNode> {
    this.ensureRoot()

    const targetPath = dirPath
      ? path.join(this.rootPath!, this.sanitizeRelativePath(dirPath))
      : this.rootPath!

    const stat = await fs.stat(targetPath)
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${targetPath}`)
    }

    return this.buildDirectoryNode(targetPath, path.basename(targetPath))
  }

  /**
   * Ensure a directory exists at the given relative path.
   * Creates it if it does not exist. Returns the full path.
   */
  async ensureDirectory(relativePath: string): Promise<string> {
    this.ensureRoot()

    const sanitized = this.sanitizeRelativePath(relativePath)
    const fullPath = path.join(this.rootPath!, sanitized)

    await fs.mkdir(fullPath, { recursive: true })
    return fullPath
  }

  /**
   * Convert a relative path to an absolute path using the root directory.
   */
  getAbsolutePath(relativePath: string): string {
    this.ensureRoot()
    return path.join(this.rootPath!, this.sanitizeRelativePath(relativePath))
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ensureRoot(): void {
    if (!this.rootPath) {
      throw new Error('Root directory has not been set. Call setRootDirectory() first.')
    }
  }

  /**
   * Sanitize a relative path to prevent directory traversal attacks.
   * Removes leading slashes and resolves any '..' segments.
   */
  private sanitizeRelativePath(relativePath: string): string {
    // Remove leading slashes to prevent absolute path injection
    let cleaned = relativePath.replace(/^[/\\]+/, '')

    // Normalize path separators to the current OS
    cleaned = cleaned.replace(/\\/g, path.sep)

    // Resolve the path and ensure it stays within root
    const resolved = path.resolve(this.rootPath!, cleaned)
    if (!resolved.startsWith(this.rootPath!)) {
      throw new Error('Path traversal detected: relative path escapes root directory')
    }

    // Return the relative portion
    return path.relative(this.rootPath!, resolved)
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async buildDirectoryNode(fullPath: string, name: string): Promise<DirectoryNode> {
    const stat = await fs.stat(fullPath)

    if (!stat.isDirectory()) {
      return {
        name,
        path: fullPath,
        type: 'file',
        size: stat.size,
      }
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true })

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    const children: DirectoryNode[] = []
    for (const entry of entries) {
      // Skip hidden files and the marker file
      if (entry.name.startsWith('.')) continue

      const entryPath = path.join(fullPath, entry.name)
      children.push(await this.buildDirectoryNode(entryPath, entry.name))
    }

    return {
      name,
      path: fullPath,
      type: 'directory',
      size: stat.size,
      children,
    }
  }
}

export const fileManager = new FileManager()
