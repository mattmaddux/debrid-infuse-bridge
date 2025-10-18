# STRM WebDAV Server

A Node.js service that periodically fetches your Real-Debrid downloads, generates `.strm` files, and serves them via WebDAV.

## Features

- 🔄 Fetches all Real-Debrid downloads (up to 5000)
- 📁 Automatic `.strm` file generation with original filenames
- 🌐 WebDAV server with no authentication required
- 🐳 Docker & Docker Compose ready
- ♻️ Auto-sync: creates new files and removes old ones
- ⚡ Configurable polling interval

## Prerequisites

- Docker and Docker Compose
- OR Node.js 18+ (for local development)

## Quick Start

### 1. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` and set your Real-Debrid API key:

```env
API_KEY=your-real-debrid-api-key
POLL_INTERVAL_MS=300000    # 5 minutes
WEBDAV_PORT=1900
```

**Getting your Real-Debrid API key:**
1. Go to https://real-debrid.com/apitoken
2. Copy your API token
3. Paste it as the `API_KEY` value

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

The server will:
- Build the Docker image
- Start polling the API immediately
- Serve files via WebDAV at `http://localhost:1900/webdav/`

### 4. Access WebDAV

Mount the WebDAV share:
- **macOS Finder**: `Cmd+K` → `http://localhost:1900/webdav/`
- **Windows Explorer**: Map network drive → `http://localhost:1900/webdav/`
- **Linux**: Use your file manager's "Connect to Server" feature

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `API_KEY` | (required) | API authentication key |
| `POLL_INTERVAL_MS` | 300000 | Polling interval in milliseconds (5 min default) |
| `WEBDAV_PORT` | 1900 | WebDAV server port |
| `STRM_DIR` | ./strm-files | Directory for generated .strm files |

## How It Works

1. **API Polling**: Every `POLL_INTERVAL_MS`, the server fetches all downloads from Real-Debrid (up to 5000)
2. **File Generation**: For each download:
   - Uses the original filename (e.g., `Star Trek Voyager s04e01.mkv`)
   - Creates a `.strm` file (e.g., `Star Trek Voyager s04e01.strm`)
   - Contents: the direct download URL
3. **Sync**: Removes `.strm` files for downloads no longer available
4. **WebDAV**: Serves the `strm-files/` directory via WebDAV

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run in development mode (with auto-reload)
npm run dev

# Or run normally
npm start
```

## Real-Debrid API

The service uses the Real-Debrid downloads API:
- **Endpoint**: `https://api.real-debrid.com/rest/1.0/downloads?limit=5000`
- **Auth**: Bearer token (your API key)
- **Response**: Array of download objects with `download` URL and `filename`

The service automatically fetches up to 5000 downloads in a single request.

## Docker Commands

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## Troubleshooting

**No files appearing:**
- Check logs: `docker-compose logs -f`
- Verify `API_KEY` is correct
- Confirm API URL in `src/api-poller.js`

**WebDAV connection fails:**
- Verify port is not in use: `lsof -i :1900`
- Check Docker port mapping in `docker-compose.yml`

**API errors:**
- Review API response format in logs
- Adjust parsing in `src/api-poller.js` if needed

## Project Structure

```
strm-webdav-server/
├── src/
│   ├── index.js           # Main server & orchestration
│   ├── api-poller.js      # API fetching logic
│   └── file-manager.js    # .strm file operations
├── strm-files/            # Generated .strm files (Docker volume)
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env
```

## License

MIT
