package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/taslabs-net/loggarr/internal/docker"
	"github.com/taslabs-net/loggarr/internal/models"
	"github.com/taslabs-net/loggarr/internal/templates/components"
)

// LogsHandler handles SSE log streaming
type LogsHandler struct {
	dockerClient *docker.Client
}

// NewLogsHandler creates a new logs handler
func NewLogsHandler(dc *docker.Client) *LogsHandler {
	return &LogsHandler{dockerClient: dc}
}

// StreamLogs handles GET /api/v1/logs - SSE endpoint
// @Summary Stream logs
// @Description Server-Sent Events stream of container logs. Returns HTML fragments for htmx, or JSON if Accept header requests it.
// @Tags logs
// @Produce text/event-stream
// @Param containers query string false "Comma-separated container IDs or names"
// @Param levels query string false "Comma-separated log levels (alert,error,warning,info,debug)"
// @Success 200 {string} string "SSE stream of log entries"
// @Router /v1/logs [get]
func (h *LogsHandler) StreamLogs(c echo.Context) error {
	// Parse container filter
	containersParam := c.QueryParam("containers")
	var containerIDs []string
	if containersParam != "" {
		containerIDs = strings.Split(containersParam, ",")
	}

	// Parse level filter (only accept valid levels)
	validLevels := map[models.LogLevel]bool{
		models.LogLevelAlert:   true,
		models.LogLevelError:   true,
		models.LogLevelWarning: true,
		models.LogLevelInfo:    true,
		models.LogLevelDebug:   true,
	}
	levelsParam := c.QueryParam("levels")
	levelFilter := make(map[models.LogLevel]bool)
	if levelsParam != "" {
		for _, l := range strings.Split(levelsParam, ",") {
			level := models.LogLevel(strings.TrimSpace(l))
			if validLevels[level] {
				levelFilter[level] = true
			}
		}
	}

	// Check if client wants JSON (for API) or HTML (for htmx)
	wantsJSON := strings.Contains(c.Request().Header.Get("Accept"), "application/json")

	// Set SSE headers
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering
	c.Response().WriteHeader(http.StatusOK)

	// Create context that cancels when client disconnects
	ctx, cancel := context.WithCancel(c.Request().Context())
	defer cancel()

	// Track active connections
	ActiveConnections.Inc()
	defer ActiveConnections.Dec()

	// Create log channel
	logChan := make(chan models.LogEntry, 100)

	// Create event channel for container events
	eventChan := make(chan models.ContainerEvent, 50)

	// Start streaming logs
	if err := h.dockerClient.StreamLogs(ctx, containerIDs, logChan); err != nil {
		return err
	}

	// Start streaming container events
	if err := h.dockerClient.StreamEvents(ctx, eventChan); err != nil {
		return err
	}

	// Stream logs to client
	for {
		select {
		case <-ctx.Done():
			return nil
		case event := <-eventChan:
			// Convert container event to log entry for display
			entry := models.LogEntry{
				ID:          fmt.Sprintf("event-%d", event.Time),
				Timestamp:   time.Unix(event.Time, 0),
				Container:   event.Name,
				ContainerID: event.ID,
				Stream:      "event",
				Message:     fmt.Sprintf("Container %s: %s", event.Name, event.Action),
				Level:       eventActionToLevel(event.Action),
				IsEvent:     true,
				EventType:   models.ContainerEventType(event.Action),
			}

			var data string
			if wantsJSON {
				jsonData, err := json.Marshal(entry)
				if err != nil {
					continue
				}
				data = string(jsonData)
			} else {
				var buf bytes.Buffer
				if err := components.LogEntry(entry).Render(ctx, &buf); err != nil {
					continue
				}
				data = buf.String()
			}

			if _, err := fmt.Fprintf(c.Response(), "event: message\ndata: %s\n\n", data); err != nil {
				return nil
			}
			c.Response().Flush()

		case entry := <-logChan:
			// Apply level filter if specified
			if len(levelFilter) > 0 && !levelFilter[entry.Level] {
				continue
			}

			// Track metrics
			LogsStreamed.WithLabelValues(entry.Container, string(entry.Level)).Inc()

			var data string
			if wantsJSON {
				jsonData, err := json.Marshal(entry)
				if err != nil {
					continue
				}
				data = string(jsonData)
			} else {
				// Render HTML fragment using templ
				var buf bytes.Buffer
				if err := components.LogEntry(entry).Render(ctx, &buf); err != nil {
					continue
				}
				data = buf.String()
			}

			// SSE format: "event: message\ndata: <content>\n\n"
			if _, err := fmt.Fprintf(c.Response(), "event: message\ndata: %s\n\n", data); err != nil {
				return nil // Client disconnected
			}
			c.Response().Flush()
		}
	}
}

// eventActionToLevel maps container events to log levels for display
func eventActionToLevel(action string) models.LogLevel {
	switch action {
	case "die", "kill", "oom":
		return models.LogLevelError
	case "stop", "pause":
		return models.LogLevelWarning
	case "start", "unpause", "create":
		return models.LogLevelInfo
	default:
		return models.LogLevelDebug
	}
}
