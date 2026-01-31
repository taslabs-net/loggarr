# Dependencies layer - prebuilt binaries work on Debian
FROM node:25-slim AS deps
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build layer
FROM deps AS builder
WORKDIR /app
COPY svelte.config.js vite.config.ts tsconfig.json ./
COPY src ./src
COPY static ./static
RUN pnpm build
RUN pnpm prune --prod --ignore-scripts

# Runtime layer - minimal
FROM node:25-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9797
ENV METRICS_PORT=9091

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 9797 9091

CMD ["node", "build"]
