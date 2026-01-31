# Contributing

Thanks for your interest in contributing to Loggarr!

## Quick Start

```bash
# Clone the repository
git clone https://github.com/taslabs-net/loggarr.git
cd loggarr

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

## Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm typecheck    # Run TypeScript checks
pnpm lint         # Run ESLint
pnpm format       # Format with Prettier
pnpm test         # Run tests
```

## Docker

```bash
# Build image
docker build -t loggarr .

# Run with docker-compose
docker compose up
```

## Version Control

We use jj (Jujutsu) for version control. Git commands work too.

## Code Standards

- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Keep code modular and easy to troubleshoot
- Separate concerns - split by responsibility, not convenience
- No dead code - remove unused code, don't comment it out
- Line length: 250 characters max

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure CI passes (typecheck, lint, format, test, build)
4. Submit a PR with a clear description

## Questions?

Open an issue or start a discussion.
