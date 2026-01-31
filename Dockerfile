FROM node:25-alpine AS builder

WORKDIR /app

# Build deps for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY svelte.config.js vite.config.ts tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production deps only (with native modules compiled)
RUN pnpm prune --prod

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
