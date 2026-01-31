# Loggarr

[![CI](https://github.com/taslabs-net/loggarr/actions/workflows/ci.yml/badge.svg)](https://github.com/taslabs-net/loggarr/actions/workflows/ci.yml)
[![Release](https://github.com/taslabs-net/loggarr/actions/workflows/release.yml/badge.svg)](https://github.com/taslabs-net/loggarr/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/taslabs-net/loggarr)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/taslabs-net/loggarr)](https://github.com/taslabs-net/loggarr/releases)

[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)

A simple Docker log viewer. Streams logs from the Docker socket with basic filtering and capture capabilities.

## Features

- **Stream logs** from all Docker containers via the Docker socket
- **Pause/Resume** log streaming
- **Save snapshots** of paused log state
- **Capture history** - configurable line buffer (default: 100, max: 1000)
- **Filter by log level** - alert, error, warning, info, debug
- **SQLite storage** for snapshots and configuration

## Quick Start

```bash
docker run -d \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/taslabs-net/loggarr:latest
```

Then open `http://localhost:8080` in your browser.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `8080` | Web UI port |
| `LOG_BUFFER_SIZE` | `100` | Number of lines to keep in memory |
| `LOG_BUFFER_MAX` | `1000` | Maximum configurable buffer size |

## Requirements

- Docker socket access (`/var/run/docker.sock`)
- Read-only access is sufficient

## Platforms

- `linux/amd64`
- `linux/arm64`

## Tech Stack

- **Frontend**: Svelte (SvelteKit)
- **Backend**: Node.js
- **Database**: SQLite (PostgreSQL/MySQL planned)
- **Real-time**: WebSocket/SSE
- **Registry**: GitHub Container Registry (ghcr.io)

## Roadmap

- [ ] Support for external databases (PostgreSQL, MySQL)
- [ ] Container filtering
- [ ] Log search
- [ ] Export to file

## License

MIT
