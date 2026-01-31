# Agents Guidelines

## Version Control

- **VCS**: jj (Jujutsu)
- **Remote**: https://github.com/taslabs-net/loggarr.git
- **Commits**: Informative but concise. No fluff, no filler.

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

Loggarr is a simple Docker log viewer that streams logs from the Docker socket.

### Core Features

- Stream logs from Docker socket (`/var/run/docker.sock`)
- Pause/resume log streaming
- Save snapshots of paused state (persisted to SQLite)
- Configurable line buffer (default 100, max 1000) - memory only, not persisted
- Filter by log level: alert, error, warning, info, debug
- SQLite for saved snapshots and configuration only
- Prometheus metrics export (port 9091)

### Technical Decisions

- **Frontend**: Svelte (SvelteKit)
- **Backend**: Node.js with native Docker API
- **Storage**: SQLite embedded (future: PostgreSQL, MySQL support)
- **Docker socket**: Read-only access, streaming via Docker API
- **Real-time**: WebSocket or SSE for log streaming
- **UI**: Bare bones, functional over flashy

## Project Structure

```
loggarr/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── svelte.config.js
├── vite.config.ts
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── docker.ts       # Docker socket interaction
│   │   │   └── storage.ts      # SQLite/database layer
│   │   └── components/         # Svelte components
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte        # Main log viewer
│   │   └── api/                # API endpoints
│   └── app.html
├── static/
├── data/                       # SQLite database (runtime)
└── tests/
```
