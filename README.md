# Debrid Infuse Bridge

A WebDAV bridge for Infuse that fetches your Real-Debrid downloads, generates `.strm` files, and serves them for seamless streaming in Infuse while files remain hosted on Real-Debrid.

## Features

- 🔄 Fetches all Real-Debrid downloads (up to 5000)
- 📁 Automatic `.strm` file generation with original filenames
- 🌐 WebDAV server with no authentication required
- 🖥️ Web browser interface for easy file browsing
- 🐳 Docker & Docker Compose ready
- ♻️ Auto-sync: creates new files and removes old ones
- ⚡ Configurable polling interval

## Prerequisites

- Docker and Docker Compose
- OR Node.js 18+ (for local development)

## Quick Start

### Option A: Using Docker Hub (Recommended)

Pull the pre-built image from Docker Hub:

```bash
# Create .env file
cat > .env << EOF
USER_ID=your-real-debrid-user-id
POLL_INTERVAL_MS=300000
WEBDAV_PORT=1900
BROWSE_PORT=1901
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  strm-webdav:
    image: mattmaddux/debrid-infuse-bridge:latest
    container_name: strm-webdav-server
    restart: unless-stopped
    ports:
      - "${WEBDAV_PORT:-1900}:1900"
      - "${BROWSE_PORT:-1901}:1901"
    environment:
      - USER_ID=${USER_ID}
      - POLL_INTERVAL_MS=${POLL_INTERVAL_MS:-300000}
      - WEBDAV_PORT=1900
      - BROWSE_PORT=1901
      - STRM_DIR=/app/strm-files
    volumes:
      - ./strm-files:/app/strm-files
EOF

# Start the service
docker-compose up -d
```

### Option B: Build from Source

### 1. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` and set your Real-Debrid user ID:

```env
USER_ID=your-real-debrid-user-id
POLL_INTERVAL_MS=300000    # 5 minutes
WEBDAV_PORT=1900
BROWSE_PORT=1901
```

**Getting your Real-Debrid user ID:**
1. Go to https://my.real-debrid.com/
2. Find your user ID in the URL: `https://my.real-debrid.com/{USER_ID}/torrents/`
3. Paste it as the `USER_ID` value

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

The server will:
- Build the Docker image
- Start polling the API immediately
- Serve files via WebDAV at `http://localhost:1900/webdav/`
- Provide a web browser interface at `http://localhost:1901/browse/`

### 3. Access Your Files

**Via Web Browser** (easiest for viewing):
- Open `http://localhost:1901/browse/` in any web browser
- Browse directories and click files to view their contents

**Via WebDAV** (for Infuse):

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
| `BROWSE_PORT` | 1901 | Web browse interface port |
| `STRM_DIR` | ./strm-files | Directory for generated .strm files |

## How It Works

1. **API Polling**: Every `POLL_INTERVAL_MS`, the server fetches all downloads from Real-Debrid (up to 5000)
2. **File Generation**: For each download:
   - Uses the original filename (e.g., `Star Trek Voyager s04e01.mkv`)
   - Creates a `.strm` file (e.g., `Star Trek Voyager s04e01.strm`)
   - Contents: the direct download URL
3. **Sync**: Removes `.strm` files for downloads no longer available
4. **Dual Access**:
   - **WebDAV** (port 1900): Serves files for Infuse and file managers
   - **HTTP Browse** (port 1901): Simple web interface for browsing files in your browser

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

### Building and Pushing to Docker Hub

```bash
# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -t mattmaddux/debrid-infuse-bridge:latest \
  -t mattmaddux/debrid-infuse-bridge:v1.0.0 \
  --push .

# Or build and push with docker compose
docker compose build
docker tag debrid-infuse-bridge-strm-webdav:latest mattmaddux/debrid-infuse-bridge:latest
docker push mattmaddux/debrid-infuse-bridge:latest
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
debrid-infuse-bridge/
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
