require('dotenv').config();
const webdav = require('webdav-server').v2;
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const FileManager = require('./file-manager');
const ApiPoller = require('./api-poller');

// Configuration from environment variables
const config = {
  userId: process.env.USER_ID,
  pollInterval: parseInt(process.env.POLL_INTERVAL_MS) || 300000, // Default 5 minutes
  webdavPort: parseInt(process.env.WEBDAV_PORT) || 1900,
  browsePort: parseInt(process.env.BROWSE_PORT) || 1901,
  strmDir: path.resolve(process.env.STRM_DIR || './strm-files')
};

// Validate required environment variables
if (!config.userId) {
  console.error('ERROR: USER_ID environment variable is required');
  console.error('This is the ID from your Real-Debrid HTTP index URL:');
  console.error('  https://my.real-debrid.com/{USER_ID}/torrents/');
  process.exit(1);
}

console.log('=== STRM WebDAV Server ===');
console.log('Configuration:');
console.log(`  WebDAV Port: ${config.webdavPort}`);
console.log(`  Browse Port: ${config.browsePort}`);
console.log(`  Poll Interval: ${config.pollInterval}ms`);
console.log(`  STRM Directory: ${config.strmDir}`);
console.log(`  User ID: ${config.userId}`);
console.log('');

// Initialize components
const fileManager = new FileManager(config.strmDir);
const apiPoller = new ApiPoller(config.userId, fileManager, config.pollInterval, config.strmDir);

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

// Create HTTP server for browse interface
const browseServer = http.createServer(async (req, res) => {
  // Parse URL path
  const urlPath = decodeURIComponent(req.url);
  
  // Only handle /browse paths
  if (!urlPath.startsWith('/browse')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Use /browse/ to view files.');
    return;
  }
  
  // Get relative path (remove /browse prefix)
  const relativePath = urlPath.substring(7).replace(/^\//, '');
  const fullPath = path.join(config.strmDir, relativePath);
  
  try {
    const stats = await fs.stat(fullPath);
    
    if (stats.isFile()) {
      // Serve file content
      const content = await fs.readFile(fullPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
      return;
    }
    
    if (!stats.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    
    // List directory
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    
    // Sort: directories first, then files alphabetically
    files.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Generate HTML
    const parentPath = relativePath ? `/browse/${path.dirname(relativePath)}`.replace(/\/\/+/g, '/') : null;
    const displayPath = relativePath || '/';
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Index of /${displayPath}</title>
  <style>
    body { font-family: monospace; margin: 20px; }
    h1 { font-size: 1.2em; }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 0; }
    a { text-decoration: none; color: #0066cc; }
    a:hover { text-decoration: underline; }
    .dir { font-weight: bold; }
    .file { color: #333; }
  </style>
</head>
<body>
  <h1>Index of /${displayPath}</h1>
  <ul>
    ${parentPath ? `<li><a href="${parentPath}" class="dir">../</a></li>` : ''}
    ${files.map(f => {
      const isDir = f.isDirectory();
      const name = isDir ? f.name + '/' : f.name;
      const href = `/browse/${path.join(relativePath, f.name)}`.replace(/\/\/+/g, '/');
      const cssClass = isDir ? 'dir' : 'file';
      return `    <li><a href="${href}" class="${cssClass}">${name}</a></li>`;
    }).join('\n')}
  </ul>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Directory not found');
    } else {
      console.error('[Browse] Error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }
});

browseServer.listen(config.browsePort, () => {
  console.log(`[Browse] HTTP server running on port ${config.browsePort}`);
  console.log(`[Browse] Access at: http://localhost:${config.browsePort}/browse/`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  apiPoller.stop();
  server.stop();
  browseServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down gracefully...');
  apiPoller.stop();
  server.stop();
  browseServer.close();
  process.exit(0);
});
