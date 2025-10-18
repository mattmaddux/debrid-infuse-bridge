require('dotenv').config();
const webdav = require('webdav-server').v2;
const path = require('path');
const FileManager = require('./file-manager');
const ApiPoller = require('./api-poller');

// Configuration from environment variables
const config = {
  apiKey: process.env.API_KEY,
  pollInterval: parseInt(process.env.POLL_INTERVAL_MS) || 300000, // Default 5 minutes
  webdavPort: parseInt(process.env.WEBDAV_PORT) || 1900,
  strmDir: path.resolve(process.env.STRM_DIR || './strm-files')
};

// Validate required environment variables
if (!config.apiKey) {
  console.error('ERROR: API_KEY environment variable is required');
  process.exit(1);
}

console.log('=== STRM WebDAV Server ===');
console.log('Configuration:');
console.log(`  WebDAV Port: ${config.webdavPort}`);
console.log(`  Poll Interval: ${config.pollInterval}ms`);
console.log(`  STRM Directory: ${config.strmDir}`);
console.log(`  API Key: ${config.apiKey.substring(0, 8)}...`);
console.log('');

// Initialize components
const fileManager = new FileManager(config.strmDir);
const apiPoller = new ApiPoller(config.apiKey, fileManager, config.pollInterval);

// Create WebDAV server
const userManager = new webdav.SimpleUserManager();
const user = userManager.addUser('anonymous', '', false); // No authentication

const server = new webdav.WebDAVServer({
  port: config.webdavPort,
  httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, 'STRM Server')
});

// Set up the file system to serve the strm-files directory
server.setFileSystem('/webdav', new webdav.PhysicalFileSystem(config.strmDir), (success) => {
  if (success) {
    console.log('[WebDAV] File system mounted at /webdav');
  } else {
    console.error('[WebDAV] Failed to mount file system');
    process.exit(1);
  }
});

// Start the WebDAV server
server.start(() => {
  console.log(`[WebDAV] Server running on port ${config.webdavPort}`);
  console.log(`[WebDAV] Access at: http://localhost:${config.webdavPort}/webdav/`);
  console.log('');
  
  // Start the API poller
  apiPoller.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  apiPoller.stop();
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down gracefully...');
  apiPoller.stop();
  server.stop();
  process.exit(0);
});
