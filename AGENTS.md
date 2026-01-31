# Agents Guidelines

## Memory MCP

Always use the Memory MCP to maintain context across sessions:

1. **Session Start**: Begin by retrieving relevant memory

   ```
   mcp_memory_read_graph() or mcp_memory_search_nodes("project name")
   ```

2. **Track Important Information**:
   - Project state and progress
   - Technical decisions made
   - User preferences
   - Remaining work/backlog

3. **Update Memory**: After significant changes, update the knowledge graph
   - Create entities for projects, components, decisions
   - Create relations to connect them
   - Add observations for facts and status

## Version Control

- **VCS**: jj (Jujutsu) - NOT git
- **Remote**: https://github.com/taslabs-net/loggarr.git
- **Commits**: Informative but concise. No fluff, no filler.
- **Commands**:
  - `jj status` - Check working copy
  - `jj log --limit 5` - Recent history
  - `jj describe -m "message"` - Update commit message
  - `jj new main -m "message"` - New change from main

## Code Standards

### Formatting

- **Line length**: 250 characters max
- **Emojis**: Only when necessary. They detract from code clarity.

### Architecture

- **Modularity**: Code must be modular and easy to troubleshoot
- **Separation of concerns**: Split by responsibility, not convenience
- **File size**: Keep files focused. If it's doing too much, split it.

### Quality

- **Fight entropy**: No dirty code. No shortcuts that accumulate debt.
- **Fix, don't ignore**: We don't create flawed code and move on. Problems get addressed.
- **No dead code**: Remove unused code, don't comment it out.

## Project Overview

Loggarr is a Docker log viewer that streams logs from the Docker socket.

### Core Features

- Stream logs from Docker socket (`/var/run/docker.sock`)
- Pause/resume log streaming with buffering
- Save snapshots of paused state (persisted to SQLite)
- Configurable line buffer (default 100, max 1000)
- Filter by container and log level (alert, error, warning, info, debug)
- Export logs as JSON/CSV
- Prometheus metrics export

### Technical Stack (Go Rewrite)

- **Backend**: Go with Echo framework
- **Frontend**: htmx + DaisyUI (no build step)
- **Templates**: templ (type-safe Go templates)
- **Database**: modernc.org/sqlite (pure Go, no CGO)
- **Docker**: docker/docker SDK
- **Metrics**: prometheus/client_golang
- **Dev**: Air for hot reload

## Project Structure

```
loggarr/
├── cmd/loggarr/main.go       # Entry point
├── go.mod, go.sum
├── Makefile                  # Build commands
├── .air.toml                 # Hot reload config
├── internal/
│   ├── config/config.go      # Environment config
│   ├── docker/
│   │   ├── client.go         # Docker client wrapper
│   │   └── logs.go           # Log streaming
│   ├── handlers/
│   │   ├── containers.go     # Container list API
│   │   ├── health.go         # Health check
│   │   ├── logs.go           # SSE log streaming
│   │   ├── metrics.go        # Prometheus metrics
│   │   ├── pages.go          # Page rendering
│   │   └── snapshots.go      # Snapshot CRUD
│   ├── models/models.go      # Types
│   ├── storage/storage.go    # SQLite layer
│   └── templates/
│       ├── index.templ       # Main page
│       └── components/       # Reusable components
├── static/
│   └── app.js                # Client-side JS
└── data/                     # SQLite database (runtime)
```

## Development

```bash
# Hot reload development
make dev

# Build binary
make build

# Run without hot reload
make run

# Generate templ files
make templ

# Format code
make fmt
```

## API Endpoints

- `GET /` - Web UI
- `GET /api/health` - Health check
- `GET /api/metrics` - Prometheus metrics
- `GET /api/v1/logs?containers=...&levels=...` - SSE log stream
- `GET /api/v1/containers` - Container list
- `GET /api/v1/snapshots` - List snapshots
- `GET /api/v1/snapshots/:id` - Get snapshot with logs
- `POST /api/v1/snapshots` - Save snapshot
- `DELETE /api/v1/snapshots/:id` - Delete snapshot

## Documentation References

### Go Echo Framework

- **Docs**: https://echo.labstack.com/docs
- **Middleware**: Logger, Recover, CORS built-in

### Docker SDK for Go

- **Docs**: https://pkg.go.dev/github.com/docker/docker/client
- **Key Methods**:
  - `cli.ContainerList()` - List containers
  - `cli.ContainerLogs()` - Stream container logs
  - `cli.Ping()` - Health check

### templ (Go Templates)

- **Docs**: https://templ.guide/
- **Generate**: `templ generate`
- **Type-safe**: Compile-time checking of templates

### Prometheus Go Client

- **Docs**: https://pkg.go.dev/github.com/prometheus/client_golang
- **Metrics**: Counter, Gauge, Histogram, Summary
