# Loggarr

[![CI](https://github.com/taslabs-net/loggarr/actions/workflows/ci.yml/badge.svg)](https://github.com/taslabs-net/loggarr/actions/workflows/ci.yml)
[![Release](https://github.com/taslabs-net/loggarr/actions/workflows/release.yml/badge.svg)](https://github.com/taslabs-net/loggarr/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/taslabs-net/loggarr)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/taslabs-net/loggarr)](https://github.com/taslabs-net/loggarr/releases)

[![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Echo](https://img.shields.io/badge/Echo-00ADD8?logo=go&logoColor=white)](https://echo.labstack.com)
[![htmx](https://img.shields.io/badge/htmx-3366CC?logo=htmx&logoColor=white)](https://htmx.org)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io)

A simple Docker log viewer. Streams logs from the Docker socket with basic filtering and capture capabilities.

## Features

- **Stream logs** from all Docker containers via the Docker socket
- **Pause/Resume** log streaming
- **Save snapshots** of paused log state
- **Export snapshots** to Markdown, JSON, or plain text
- **Search logs** with regex support and real-time filtering
- **Capture history** - configurable line buffer (default: 100, max: 1000)
- **Filter by log level** - alert, error, warning, info, debug
- **Keyboard shortcuts** for power users (press `?` for help)
- **SQLite storage** for saved snapshots and configuration (streaming logs are memory-only)
- **Prometheus metrics** at `/api/metrics`
- **Health check** endpoint at `/api/health`

<img width="1912" height="794" alt="image" src="https://github.com/user-attachments/assets/32adda50-4914-4e76-b9fd-ef471d363a32" />

## Quick Start

**Docker Hub:**
```bash
docker run -d \
  -p 9797:9797 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  taslabs/loggarr:latest
```

**GitHub Container Registry:**
```bash
docker run -d \
  -p 9797:9797 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/taslabs-net/loggarr:latest
```

Then open `http://localhost:9797` in your browser.

## Configuration

| Environment Variable | Default                    | Description                      |
| -------------------- | -------------------------- | -------------------------------- |
| `PORT`               | `9797`                     | Web UI port                      |
| `LOG_BUFFER_MAX`     | `1000`                     | Maximum log lines in memory      |
| `LOG_TAIL_LINES`     | `10`                       | Initial lines to load per container |
| `DATA_DIR`           | `./data`                   | SQLite database directory        |
| `DOCKER_SOCKET`      | `/var/run/docker.sock`     | Docker socket path               |

## Keyboard Shortcuts

| Key       | Action                      |
| --------- | --------------------------- |
| `Space`   | Pause / Resume              |
| `/`       | Focus search                |
| `j` / `k` | Scroll down / up            |
| `g g`     | Go to top                   |
| `G`       | Go to bottom                |
| `s`       | Save snapshot (when paused) |
| `?`       | Show shortcuts help         |
| `Esc`     | Close help                  |

## Requirements

- Docker socket access (`/var/run/docker.sock`)
- Read-only access is sufficient

## Platforms

- `linux/amd64`
- `linux/arm64`

## Tech Stack

- **Backend**: Go with Echo framework
- **Frontend**: htmx + DaisyUI (no build step)
- **Templates**: templ (type-safe Go templates)
- **Database**: SQLite (pure Go, no CGO)
- **Real-time**: Server-Sent Events (SSE)
- **Registry**: Docker Hub + GitHub Container Registry

## API Documentation

Swagger UI available at `/api/docs/index.html`

## Development

```bash
make dev          # Hot reload with Air
make build        # Build binary
make swagger      # Generate API docs
make test         # Run tests
```

## License

MIT
