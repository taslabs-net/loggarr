# Contributing

Thanks for your interest in contributing to Loggarr!

## Quick Start

```bash
# Clone the repository
git clone https://github.com/taslabs-net/loggarr.git
cd loggarr

# Build the Docker image
docker build -t loggarr .

# Run locally
docker run -p 8080:8080 loggarr
```

## Development

We use jj (Jujutsu) for version control. If you're using git, commits will still work.

## Code Standards

- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- Keep code modular and easy to troubleshoot
- Separate concerns - split by responsibility, not convenience
- No dead code - remove unused code, don't comment it out
- Line length: 250 characters max

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure CI passes (lint, test, build)
4. Submit a PR with a clear description

## Questions?

Open an issue or start a discussion.
