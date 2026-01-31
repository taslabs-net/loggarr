# Build tools layer - cached separately
FROM node:25-alpine AS base
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm

# Dependencies layer - cached when lockfile unchanged
FROM base AS deps
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
RUN pnpm prune --prod

# Runtime layer - minimal
FROM node:25-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9797
ENV METRICS_PORT=9091

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 9797 9091

CMD ["node", "build"]
