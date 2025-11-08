const fs = require('fs').promises;
const path = require('path');

class FileManager {
  constructor(strmDir) {
    this.strmDir = strmDir;
  }

  /**
   * Ensure the strm directory exists
   */
  async ensureDirectory() {
    try {
      await fs.mkdir(this.strmDir, { recursive: true });
      console.log(`[FileManager] Directory ready: ${this.strmDir}`);
    } catch (error) {
      console.error('[FileManager] Error creating directory:', error);
      throw error;
    }
  }

  /**
   * Convert filename to .strm extension, preserving folder path if provided
   * Example: {folder: "Show S01", filename: "Episode.mkv"} -> Show S01/Episode.strm
   */
  getStrmFilename(urlOrFilename, providedFilename = null, folderPath = null) {
    let basename;
    
    if (providedFilename) {
      // Use filename from API (Real-Debrid provides this)
      basename = providedFilename;
    } else {
      // Fallback: extract from URL
      const urlPath = new URL(urlOrFilename).pathname;
      basename = path.basename(urlPath);
    }
    
    // Strip extension and add .strm
    const nameWithoutExt = basename.substring(0, basename.lastIndexOf('.')) || basename;
    const strmFilename = `${nameWithoutExt}.strm`;
    
    // Preserve folder path if provided
    if (folderPath) {
      return path.join(folderPath, strmFilename);
    }
    return strmFilename;
  }

  /**
   * Create a .strm file with the URL as content
   * @param {string|object} item - Either a URL string or {url, filename, folder} object
   */
  async createStrmFile(item) {
    try {
      // Handle both string URLs and {url, filename, folder} objects
      const url = typeof item === 'string' ? item : item.url;
      const providedFilename = typeof item === 'object' ? item.filename : null;
      const folderPath = typeof item === 'object' ? item.folder : null;
      
      const filename = this.getStrmFilename(url, providedFilename, folderPath);
      const filePath = path.join(this.strmDir, filename);
      
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      await fs.writeFile(filePath, url, 'utf8');
      console.log(`[FileManager] Created: ${filename}`);
      return filename;
    } catch (error) {
      console.error(`[FileManager] Error creating file:`, error);
      throw error;
    }
  }

  /**
   * Get all existing .strm files recursively
   */
  async getExistingFiles(dir = this.strmDir, relativePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden/cache directories
          if (entry.name.startsWith('.')) continue;
          // Recursively get files from subdirectories
          const subFiles = await this.getExistingFiles(fullPath, relPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.strm')) {
          files.push(relPath);
        }
      }
      
      return files;
    } catch (error) {
      console.error('[FileManager] Error reading directory:', error);
      return [];
    }
  }

/**
 * Remove empty directories recursively
 */
async removeEmptyDirectories(dir = this.strmDir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Recursively clean subdirectories first
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const fullPath = path.join(dir, entry.name);
        await this.removeEmptyDirectories(fullPath);
      }
    }
    
    // Check if this directory is now empty (after cleaning subdirs)
    const remainingEntries = await fs.readdir(dir);
    const hasContent = remainingEntries.some(name => !name.startsWith('.'));
    
    // Don't remove the root strm directory itself
    if (!hasContent && dir !== this.strmDir) {
      await fs.rmdir(dir);
      const relPath = path.relative(this.strmDir, dir);
      console.log(`[FileManager] Removed empty folder: ${relPath}`);
    }
  } catch (error) {
    console.error('[FileManager] Error removing empty directories:', error);
  }
}

/**
 * Sync .strm files with API items
 * - Create new files for new items
 * - Remove files for items no longer in the API
 * - Clean up empty folders
 * @param {Array} items - Array of {url, filename, folder} objects from API
 */
async syncFiles(items) {
  await this.ensureDirectory();

  // Build set of expected filenames (with folder paths)
  const expectedFiles = new Set(
    items.map(item => this.getStrmFilename(item.url, item.filename, item.folder))
  );
  const existingFiles = await this.getExistingFiles();

  // Create new files
  for (const item of items) {
    await this.createStrmFile(item);
  }

  // Remove files that are no longer in the API
  for (const file of existingFiles) {
    if (!expectedFiles.has(file)) {
      const filePath = path.join(this.strmDir, file);
      await fs.unlink(filePath);
      console.log(`[FileManager] Removed: ${file}`);
    }
  }

  // Clean up empty folders
  await this.removeEmptyDirectories();

  console.log(`[FileManager] Sync complete. ${expectedFiles.size} files.`);
}

}

module.exports = FileManager;
