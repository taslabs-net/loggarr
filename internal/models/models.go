package models

import (
	"time"
)

// LogLevel represents the severity of a log entry
type LogLevel string

const (
	LogLevelDebug   LogLevel = "debug"
	LogLevelInfo    LogLevel = "info"
	LogLevelWarning LogLevel = "warning"
	LogLevelError   LogLevel = "error"
	LogLevelAlert   LogLevel = "alert"
)

// ContainerEventType represents a Docker container lifecycle event
type ContainerEventType string

const (
	EventStart        ContainerEventType = "start"
	EventStop         ContainerEventType = "stop"
	EventRestart      ContainerEventType = "restart"
	EventDie          ContainerEventType = "die"
	EventHealthStatus ContainerEventType = "health_status"
	EventCreate       ContainerEventType = "create"
	EventDestroy      ContainerEventType = "destroy"
)

// LogEntry represents a single log line from a container
type LogEntry struct {
	ID          string             `json:"id"`
	Timestamp   time.Time          `json:"timestamp"`
	Container   string             `json:"container"`
	ContainerID string             `json:"containerId"`
	Stream      string             `json:"stream"` // "stdout" or "stderr"
	Message     string             `json:"message"`
	Level       LogLevel           `json:"level"`
	IsEvent     bool               `json:"isEvent,omitempty"`
	EventType   ContainerEventType `json:"eventType,omitempty"`
}

// Container represents a Docker container summary
type Container struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Image  string `json:"image"`
	State  string `json:"state"`
	Status string `json:"status"`
}

// ContainerEvent represents a Docker container lifecycle event
type ContainerEvent struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Action string `json:"action"`
	Time   int64  `json:"time"`
}

// Snapshot represents a saved collection of logs
type Snapshot struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	CreatedAt time.Time  `json:"createdAt"`
	Logs      []LogEntry `json:"logs,omitempty"`
}
