# Loggarr - Docker Log Viewer

Simple Docker log viewer with real-time streaming, filtering, and snapshot capture.

## Quick Start

```bash
docker run -d \
  -p 9797:9797 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  taslabs/loggarr:latest
```

Open `http://localhost:9797`

## Docker Compose

```yaml
services:
  loggarr:
    image: taslabs/loggarr:latest
    ports:
      - '9797:9797'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./data:/app/data
    environment:
      - LOG_BUFFER_MAX=1000
      - LOG_TAIL_LINES=10
    restart: unless-stopped
```

## Environment Variables

```bash
# Maximum log lines to keep in browser buffer (10-10000)
LOG_BUFFER_MAX=1000

# Number of historical log lines to fetch per container on connect
LOG_TAIL_LINES=10

# Data directory for SQLite database (snapshots)
DATA_DIR=./data

# Docker socket path (usually auto-detected)
# DOCKER_SOCKET=/var/run/docker.sock
```

## Documentation

Full documentation, API reference, and source code:  
**https://github.com/taslabs-net/loggarr**
