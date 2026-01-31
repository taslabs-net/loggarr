# Build stage
FROM golang:alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# Install templ
RUN go install github.com/a-h/templ/cmd/templ@latest

# Copy go mod files first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Generate templ and build
ARG VERSION=dev
RUN templ generate
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w -X github.com/taslabs-net/loggarr/internal/config.Version=${VERSION}" -o loggarr ./cmd/loggarr

# Runtime stage - minimal
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

ENV PORT=9797
ENV DATA_DIR=/app/data

COPY --from=builder /app/loggarr .
COPY --from=builder /app/static ./static

EXPOSE 9797

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9797/api/health || exit 1

CMD ["./loggarr"]
