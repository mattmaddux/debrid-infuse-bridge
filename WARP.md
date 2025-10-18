# Debrid Infuse Bridge - Warp AI Rules

## Project Overview
WebDAV bridge for Infuse media player that:
1. Fetches Real-Debrid downloads at configurable intervals
2. Creates `.strm` files (one URL per file) using original filenames
3. Serves those files via WebDAV for Infuse to consume (no authentication)

**Tech Stack:** Node.js, webdav-server, axios, Docker

## Project Structure
```
debrid-infuse-bridge/
├── src/
│   ├── index.js           # Main server, WebDAV setup, orchestration
│   ├── api-poller.js      # API fetching logic, interval management
│   └── file-manager.js    # .strm file creation/deletion/sync
├── strm-files/            # Generated .strm files (Docker volume)
├── Dockerfile
├── docker-compose.yml
├── Taskfile.yml          # Task automation
└── .env                   # Configuration (not in git)
```

## Key Components

### API Poller (`src/api-poller.js`)
- **Real-Debrid API URL** at line 11: `https://api.real-debrid.com/rest/1.0/downloads?limit=5000`
- Uses `API_KEY` from environment for authentication (Bearer token)
- Response format: Array of objects with `{download: url, filename: name, ...}`
- Extracts `download` URL and `filename` from each object
- Fetches up to 5000 downloads in single request
- Runs immediately on start, then on interval

### File Manager (`src/file-manager.js`)
- Uses original filenames from Real-Debrid API
- Converts to `.strm`: `Star Trek Voyager s04e01.mkv` → `Star Trek Voyager s04e01.strm`
- File content: direct download URL
- Auto-syncs: creates new files, removes old ones not in API
- Handles both string URLs and `{url, filename}` objects

### Main Server (`src/index.js`)
- WebDAV server on port from `WEBDAV_PORT` env var (default: 1900)
- No authentication (open access)
- Serves `/webdav/` endpoint mapping to `strm-files/` directory
- Graceful shutdown on SIGINT/SIGTERM

## Environment Variables
```
API_KEY            (required) - API authentication key
POLL_INTERVAL_MS   (default: 300000) - Polling interval in ms
WEBDAV_PORT        (default: 1900) - WebDAV server port
STRM_DIR           (default: ./strm-files) - Directory for .strm files
```

## Common Task Commands
```bash
task init          # First-time setup: create .env, build, start
task up            # Start service
task restart       # Rebuild and restart
task down          # Stop service
task logs          # Follow logs
task logs-tail     # Last 100 lines
task status        # Container status
task shell         # Shell into container
task list-files    # Show .strm files
task test-webdav   # Test WebDAV endpoint
task config        # Show current .env config
task clean         # Remove everything
```

## Development Workflow

### Making Code Changes
1. Edit source files in `src/`
2. Run `task restart` to rebuild and restart
3. Watch logs with `task logs`

### Changing API Parameters
1. Edit `src/api-poller.js` line 11
2. Modify the `apiUrl` query parameters (e.g., change `limit`)
3. Run `task restart`

**Note:** Real-Debrid API is hardcoded. Max limit is 5000.

### Real-Debrid API Details
**Endpoint:** `https://api.real-debrid.com/rest/1.0/downloads?limit=5000`

**Response structure:**
```json
[
  {
    "id": "XXXX",
    "filename": "Movie Name.mkv",
    "download": "https://...",
    "filesize": 123456,
    ...
  }
]
```

**Key fields used:**
- `download` - Direct download URL (goes in .strm file)
- `filename` - Original filename (used for .strm filename)

### Testing
- Check logs: `task logs`
- List files: `task list-files` or `ls strm-files/`
- Test WebDAV: `task test-webdav` or access `http://localhost:1900/webdav/` in browser

## Docker Notes
- Files persist in `./strm-files/` (Docker volume)
- Container runs Node.js 20 Alpine
- Auto-restarts unless stopped manually
- Health check pings WebDAV endpoint every 30s

## WebDAV Access
- **URL**: `http://localhost:1900/webdav/`
- **macOS**: Finder → Cmd+K → enter URL
- **Windows**: Map network drive → enter URL
- **Linux**: File manager → Connect to Server

## Troubleshooting

### No Files Generated
- Check logs: `task logs`
- Verify API_KEY is correct in .env
- Confirm API URL in `src/api-poller.js`
- Ensure API returns expected format

### WebDAV Not Accessible
- Check service status: `task status`
- Verify port not in use: `lsof -i :1900`
- Test endpoint: `task test-webdav`

### Container Won't Start
- Check logs: `task logs`
- Verify .env has API_KEY set
- Rebuild: `task restart`

## File Naming Logic
The file manager uses the original filename from Real-Debrid API:
- Real-Debrid provides: `Star Trek Voyager s04e01.mkv`
- Strips extension: `Star Trek Voyager s04e01`
- Adds `.strm`: `Star Trek Voyager s04e01.strm`

Fallback (if no filename provided):
- Extracts from URL path: `https://domain.com/path/MyMovie.mkv`
- Results in: `MyMovie.strm`

## Maintenance

### Updating Dependencies
```bash
# In container or locally
npm update
task restart
```

### Viewing Container Logs
```bash
task logs          # Follow mode
task logs-tail     # Recent only
```

### Cleaning Up
```bash
task down          # Stop, keep volumes
task clean         # Stop, remove volumes and images
```

## Future Enhancements (Not Implemented)
- Authentication for WebDAV
- Health check endpoint
- Metrics/monitoring
- Multiple API endpoints
- Custom file naming templates
- Webhook support for immediate updates
