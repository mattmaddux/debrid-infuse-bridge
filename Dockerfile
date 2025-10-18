FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create directory for .strm files
RUN mkdir -p /app/strm-files

# Expose WebDAV port (default 1900, configurable via env)
EXPOSE 1900

# Set default environment variables
ENV NODE_ENV=production \
    STRM_DIR=/app/strm-files

# Start the server
CMD ["node", "src/index.js"]
