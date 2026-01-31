FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY svelte.config.js vite.config.ts tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9797
ENV METRICS_PORT=9091

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

EXPOSE 9797 9091

CMD ["node", "build"]
