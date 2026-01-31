.PHONY: dev build run clean templ test

GOBIN := $(shell go env GOPATH)/bin
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X github.com/taslabs-net/loggarr/internal/config.Version=$(VERSION)"

# Development with hot reload
dev:
	@command -v $(GOBIN)/air >/dev/null 2>&1 || { echo "Installing air..."; go install github.com/air-verse/air@latest; }
	$(GOBIN)/air

# Generate templ files
templ:
	@command -v $(GOBIN)/templ >/dev/null 2>&1 || { echo "Installing templ..."; go install github.com/a-h/templ/cmd/templ@latest; }
	$(GOBIN)/templ generate

# Build binary
build: templ
	go build $(LDFLAGS) -o loggarr ./cmd/loggarr

# Run without hot reload
run: build
	./loggarr

# Clean build artifacts
clean:
	rm -rf tmp loggarr
	go clean

# Run tests
test:
	go test -v ./...

# Format code
fmt:
	go fmt ./...
	$(GOBIN)/templ fmt .

# Check for issues
lint:
	@command -v golangci-lint >/dev/null 2>&1 || { echo "Install golangci-lint: https://golangci-lint.run/usage/install/"; exit 1; }
	golangci-lint run
