const axios = require('axios');

class ApiPoller {
  constructor(apiKey, fileManager, pollInterval) {
    this.apiKey = apiKey;
    this.fileManager = fileManager;
    this.pollInterval = pollInterval;
    this.timer = null;
    
    // Real-Debrid API endpoint with limit=5000 to get all downloads
    this.apiUrl = 'https://api.real-debrid.com/rest/1.0/downloads?limit=5000';
  }

  /**
   * Fetch URLs from the API
   */
  async fetchUrls() {
    try {
      console.log('[ApiPoller] Fetching URLs from API...');
      
      const response = await axios.get(this.apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      // Real-Debrid API returns array of download objects
      // Each object has: { download, filename, ... }
      const downloads = response.data;
      
      if (!Array.isArray(downloads)) {
        throw new Error('API response is not an array');
      }

      // Extract download URLs and filenames
      const items = downloads.map(item => ({
        url: item.download,
        filename: item.filename
      }));

      console.log(`[ApiPoller] Fetched ${items.length} downloads`);
      
      // Log total count from header if available
      const totalCount = response.headers['x-total-count'];
      if (totalCount) {
        console.log(`[ApiPoller] Total available: ${totalCount}`);
      }

      return items;
    } catch (error) {
      console.error('[ApiPoller] Error fetching URLs:', error.message);
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
  start() {
    console.log(`[ApiPoller] Starting poller (interval: ${this.pollInterval}ms)`);
    
    // Run immediately on start
    this.poll();
    
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
