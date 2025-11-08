const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

class ApiPoller {
  constructor(userId, fileManager, pollInterval, strmDir) {
    this.userId = userId;
    this.fileManager = fileManager;
    this.pollInterval = pollInterval;
    this.timer = null;
    
    // Base URL for HTTP index scraping
    this.baseUrl = `https://my.real-debrid.com/${userId}/torrents/`;
    
    // Cache file path (stored alongside strm files)
    this.cacheFile = path.join(strmDir, '.torrents-cache.json');
    this.cache = {}; // { folderName: [fileNames] }
  }

  /**
   * Load cache from disk
   */
  async loadCache() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      this.cache = JSON.parse(data);
      console.log(`[ApiPoller] Loaded cache with ${Object.keys(this.cache).length} folders`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[ApiPoller] Error loading cache:', error.message);
      }
      this.cache = {};
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache() {
    try {
      await fs.writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('[ApiPoller] Error saving cache:', error.message);
    }
  }

  /**
   * Parse HTML directory listing to extract file links
   */
  parseDirectoryListing(html) {
    const $ = cheerio.load(html);
    const items = [];

    $('table tr').each((_, row) => {
      const link = $(row).find('td a').first();
      const href = link.attr('href');
      
      if (href && href !== '../' && !href.startsWith('.')) {
        items.push({
          name: link.text().trim(),
          href: href,
          isDirectory: href.endsWith('/')
        });
      }
    });

    return items;
  }

  /**
   * Fetch URLs from the HTTP index (with caching)
   */
  async fetchUrls() {
    try {
      console.log('[ApiPoller] Checking for changes...');
      const allFiles = [];
      
      // Add browser-like headers to avoid 403
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      
      // Fetch torrents directory listing (always check top level)
      const torrentsResponse = await axios.get(this.baseUrl, { headers });
      const torrentFolders = this.parseDirectoryListing(torrentsResponse.data);
      
      const currentFolderNames = new Set(torrentFolders.filter(f => f.isDirectory).map(f => f.name));
      const cachedFolderNames = new Set(Object.keys(this.cache));
      
      // Find new and removed folders
      const newFolders = [...currentFolderNames].filter(name => !cachedFolderNames.has(name));
      const removedFolders = [...cachedFolderNames].filter(name => !currentFolderNames.has(name));
      
      console.log(`[ApiPoller] Found ${torrentFolders.length} folders (${newFolders.length} new, ${removedFolders.length} removed)`);

      // Remove deleted folders from cache and collect their files for deletion
      const filesToRemove = [];
      for (const folderName of removedFolders) {
        const files = this.cache[folderName] || [];
        filesToRemove.push(...files);
        delete this.cache[folderName];
      }

      // Fetch new folders only
      let scanned = 0;
      for (const folder of torrentFolders) {
        if (!folder.isDirectory) continue;
        
        // Skip if folder is cached and not new
        if (cachedFolderNames.has(folder.name) && !newFolders.includes(folder.name)) {
          // Use cached files
          const cachedFiles = this.cache[folder.name] || [];
          const folderUrl = this.baseUrl + folder.href;
          for (const filename of cachedFiles) {
            allFiles.push({
              url: folderUrl + filename,
              filename: filename,
              folder: folder.name  // Add folder name
            });
          }
          continue;
        }
        
        // Fetch new/changed folder
        try {
          const folderUrl = this.baseUrl + folder.href;
          const folderResponse = await axios.get(folderUrl, { headers });
          const files = this.parseDirectoryListing(folderResponse.data);
          
          const fileNames = [];
          for (const file of files) {
            if (!file.isDirectory) {
              fileNames.push(file.name);
              allFiles.push({
                url: folderUrl + file.name,
                filename: file.name,
                folder: folder.name  // Add folder name
              });
            }
          }
          
          // Update cache
          this.cache[folder.name] = fileNames;
          scanned++;
        } catch (error) {
          console.error(`[ApiPoller] Error fetching folder ${folder.name}:`, error.message);
        }
      }

      console.log(`[ApiPoller] Scanned ${scanned} folders, ${allFiles.length} files total`);
      
      // Save updated cache
      await this.saveCache();
      
      return allFiles;
    } catch (error) {
      console.error('[ApiPoller] Error scraping HTTP index:', error.message);
      throw error;
    }
  }

  /**
   * Poll API and sync files
   */
  async poll() {
    try {
      const urls = await this.fetchUrls();
      await this.fileManager.syncFiles(urls);
    } catch (error) {
      console.error('[ApiPoller] Poll failed:', error.message);
    }
  }

  /**
   * Start polling on interval
   */
  async start() {
    console.log(`[ApiPoller] Starting poller (interval: ${this.pollInterval}ms)`);
    
    // Load cache first
    await this.loadCache();
    
    // Run immediately on start
    await this.poll();
    
    // Then run on interval
    this.timer = setInterval(() => this.poll(), this.pollInterval);
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[ApiPoller] Poller stopped');
    }
  }
}

module.exports = ApiPoller;
