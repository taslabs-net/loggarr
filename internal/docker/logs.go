package docker

import (
	"bufio"
	"context"
	"encoding/binary"
	"io"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"

	"github.com/taslabs-net/loggarr/internal/models"
)

var logIDCounter atomic.Uint64

// ansiPattern matches ANSI escape sequences
var ansiPattern = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07`)

// stripANSI removes ANSI escape codes from a string
func stripANSI(s string) string {
	return ansiPattern.ReplaceAllString(s, "")
}

// Structured log patterns - checked first (highest priority)
// These match explicit level declarations in structured logging formats
var structuredPatterns = map[models.LogLevel]*regexp.Regexp{
	models.LogLevelAlert:   regexp.MustCompile(`(?i)(level|lvl|severity)\s*[=:]\s*"?(fatal|panic|critical|alert|emergency)"?|\[(FATAL|PANIC|CRITICAL|ALERT|EMERGENCY)\]`),
	models.LogLevelError:   regexp.MustCompile(`(?i)(level|lvl|severity)\s*[=:]\s*"?(error|err)"?|\[(ERROR|ERR)\]|^ERROR:`),
	models.LogLevelWarning: regexp.MustCompile(`(?i)(level|lvl|severity)\s*[=:]\s*"?(warn|warning)"?|\[(WARN|WARNING)\]|^WARN(ING)?:`),
	models.LogLevelInfo:    regexp.MustCompile(`(?i)(level|lvl|severity)\s*[=:]\s*"?(info|notice)"?|\[(INFO|NOTICE)\]|^INFO:`),
	models.LogLevelDebug:   regexp.MustCompile(`(?i)(level|lvl|severity)\s*[=:]\s*"?(debug|trace|verbose)"?|\[(DEBUG|TRACE|VERBOSE)\]|^DEBUG:`),
}

// Keyword patterns - fallback for unstructured logs
var keywordPatterns = map[models.LogLevel][]*regexp.Regexp{
	models.LogLevelAlert: {
		regexp.MustCompile(`(?i)\balert\b`),
		regexp.MustCompile(`(?i)\bcritical\b`),
		regexp.MustCompile(`(?i)\bfatal\b`),
		regexp.MustCompile(`(?i)\bemergency\b`),
		regexp.MustCompile(`(?i)\bpanic\b`),
	},
	models.LogLevelError: {
		regexp.MustCompile(`(?i)\berror[: ]\b`),
		regexp.MustCompile(`(?i)\bexception\b`),
		regexp.MustCompile(`(?i)\bfailed to\b`),
		regexp.MustCompile(`(?i)\bfailure\b`),
	},
	models.LogLevelWarning: {
		regexp.MustCompile(`(?i)\bwarn(ing)?[: ]\b`),
		regexp.MustCompile(`(?i)\bcaution\b`),
	},
	models.LogLevelInfo: {
		regexp.MustCompile(`(?i)\bnotice\b`),
		regexp.MustCompile(`(?i)\blog[: ]\b`),
	},
	models.LogLevelDebug: {
		regexp.MustCompile(`(?i)\bdebug[: ]\b`),
		regexp.MustCompile(`(?i)\btrace[: ]\b`),
		regexp.MustCompile(`(?i)\bverbose\b`),
	},
}

// detectLogLevel analyzes the message to determine log level
// Priority: 1) Structured patterns (level=X) 2) Keyword patterns 3) Default to info
func detectLogLevel(message string, stream string) models.LogLevel {
	levelPriority := []models.LogLevel{
		models.LogLevelAlert,
		models.LogLevelError,
		models.LogLevelWarning,
		models.LogLevelInfo,
		models.LogLevelDebug,
	}

	// First pass: check structured log patterns (highest confidence)
	for _, level := range levelPriority {
		if pattern := structuredPatterns[level]; pattern != nil && pattern.MatchString(message) {
			return level
		}
	}

	// Second pass: keyword-based detection (lower confidence)
	for _, level := range levelPriority {
		for _, pattern := range keywordPatterns[level] {
			if pattern.MatchString(message) {
				return level
			}
		}
	}

	// Default to info
	return models.LogLevelInfo
}

// generateLogID creates a unique ID for a log entry
func generateLogID() string {
	return time.Now().Format("20060102150405") + "-" +
		string(rune('a'+logIDCounter.Add(1)%26))
}

// StreamLogs streams logs from specified containers
func (c *Client) StreamLogs(ctx context.Context, containerIDs []string, out chan<- models.LogEntry) error {
	containers, err := c.GetRunningContainers(ctx)
	if err != nil {
		return err
	}

	// Filter containers if specific IDs provided
	if len(containerIDs) > 0 {
		idSet := make(map[string]bool)
		for _, id := range containerIDs {
			idSet[id] = true
		}
		filtered := make([]types.Container, 0)
		for _, cont := range containers {
			name := ""
			if len(cont.Names) > 0 {
				name = strings.TrimPrefix(cont.Names[0], "/")
			}
			if idSet[cont.ID] || idSet[name] {
				filtered = append(filtered, cont)
			}
		}
		containers = filtered
	}

	// Start a goroutine for each container
	for _, cont := range containers {
		go c.streamContainerLogs(ctx, cont, out)
	}

	return nil
}

// streamContainerLogs streams logs from a single container
func (c *Client) streamContainerLogs(ctx context.Context, cont types.Container, out chan<- models.LogEntry) {
	containerName := ""
	if len(cont.Names) > 0 {
		containerName = strings.TrimPrefix(cont.Names[0], "/")
	} else {
		containerName = cont.ID[:12]
	}

	reader, err := c.cli.ContainerLogs(ctx, cont.ID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       c.tailLines,
		Timestamps: false,
	})
	if err != nil {
		return
	}
	defer reader.Close()

	// Docker multiplexed stream format:
	// [8]byte header: [1]byte stream type, [3]byte padding, [4]byte size
	// followed by payload
	header := make([]byte, 8)
	bufReader := bufio.NewReader(reader)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Read header
		_, err := io.ReadFull(bufReader, header)
		if err != nil {
			if err == io.EOF || ctx.Err() != nil {
				return
			}
			continue
		}

		// Parse header
		streamType := header[0] // 1 = stdout, 2 = stderr
		size := binary.BigEndian.Uint32(header[4:8])

		if size == 0 {
			continue
		}

		// Read payload
		payload := make([]byte, size)
		_, err = io.ReadFull(bufReader, payload)
		if err != nil {
			continue
		}

		message := strings.TrimSpace(string(payload))
		if message == "" {
			continue
		}

		// Strip ANSI escape codes for clean display
		cleanMessage := stripANSI(message)

		stream := "stdout"
		if streamType == 2 {
			stream = "stderr"
		}

		entry := models.LogEntry{
			ID:          generateLogID(),
			Timestamp:   time.Now(),
			Container:   containerName,
			ContainerID: cont.ID,
			Stream:      stream,
			Message:     cleanMessage,
			Level:       detectLogLevel(cleanMessage, stream),
		}

		select {
		case out <- entry:
		case <-ctx.Done():
			return
		}
	}
}
