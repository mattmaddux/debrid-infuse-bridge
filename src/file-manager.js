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
   * Convert filename to .strm extension
   * If filename provided (from API), use it; otherwise extract from URL
   * Example: MyMovie.mkv -> MyMovie.strm
   */
  getStrmFilename(urlOrFilename, providedFilename = null) {
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
    return `${nameWithoutExt}.strm`;
  }

  /**
   * Create a .strm file with the URL as content
   * @param {string|object} item - Either a URL string or {url, filename} object
   */
  async createStrmFile(item) {
    try {
      // Handle both string URLs and {url, filename} objects
      const url = typeof item === 'string' ? item : item.url;
      const providedFilename = typeof item === 'object' ? item.filename : null;
      
      const filename = this.getStrmFilename(url, providedFilename);
      const filePath = path.join(this.strmDir, filename);
      
      await fs.writeFile(filePath, url, 'utf8');
      console.log(`[FileManager] Created: ${filename}`);
      return filename;
    } catch (error) {
      console.error(`[FileManager] Error creating file:`, error);
      throw error;
    }
  }

  /**
   * Get all existing .strm files
   */
  async getExistingFiles() {
    try {
      const files = await fs.readdir(this.strmDir);
    return files.filter(file => file.endsWith('.strm'));
  } catch (error) {
    console.error('[FileManager] Error reading directory:', error);
    return [];
  }
}

/**
 * Sync .strm files with API items
 * - Create new files for new items
 * - Remove files for items no longer in the API
 * @param {Array} items - Array of {url, filename} objects from API
 */
async syncFiles(items) {
  await this.ensureDirectory();

  // Build set of expected filenames
  const expectedFiles = new Set(
    items.map(item => this.getStrmFilename(item.url, item.filename))
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

  console.log(`[FileManager] Sync complete. ${expectedFiles.size} files.`);
}

}

module.exports = FileManager;
