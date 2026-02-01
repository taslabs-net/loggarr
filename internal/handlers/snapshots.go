package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/taslabs-net/loggarr/internal/models"
	"github.com/taslabs-net/loggarr/internal/storage"
)

const (
	maxLogsPerSnapshot = 10000
	maxLogMessageSize  = 10000
)

// SnapshotsHandler handles snapshot operations
type SnapshotsHandler struct {
	storage *storage.Storage
}

// NewSnapshotsHandler creates a new snapshots handler
func NewSnapshotsHandler(store *storage.Storage) *SnapshotsHandler {
	return &SnapshotsHandler{storage: store}
}

// SaveSnapshotRequest is the request body for saving a snapshot
type SaveSnapshotRequest struct {
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	Containers  []string          `json:"containers"`
	Levels      []string          `json:"levels"`
	Logs        []models.LogEntry `json:"logs"`
}

// ListSnapshots handles GET /api/v1/snapshots
// @Summary List snapshots
// @Description Get list of all saved log snapshots
// @Tags snapshots
// @Produce json
// @Success 200 {array} storage.Snapshot
// @Failure 500 {object} map[string]string
// @Router /v1/snapshots [get]
func (h *SnapshotsHandler) ListSnapshots(c echo.Context) error {
	snapshots, err := h.storage.ListSnapshots()
	if err != nil {
		log.Printf("error listing snapshots: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list snapshots"})
	}
	if snapshots == nil {
		snapshots = []storage.Snapshot{}
	}
	return c.JSON(http.StatusOK, snapshots)
}

// GetSnapshot handles GET /api/v1/snapshots/:id
// @Summary Get snapshot
// @Description Get a snapshot by ID including all logs
// @Tags snapshots
// @Produce json
// @Param id path int true "Snapshot ID"
// @Success 200 {object} storage.Snapshot
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/snapshots/{id} [get]
func (h *SnapshotsHandler) GetSnapshot(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid snapshot ID"})
	}

	snapshot, err := h.storage.GetSnapshot(id)
	if err != nil {
		log.Printf("error getting snapshot %d: %v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get snapshot"})
	}
	if snapshot == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "snapshot not found"})
	}

	return c.JSON(http.StatusOK, snapshot)
}

// SaveSnapshot handles POST /api/v1/snapshots
// @Summary Save snapshot
// @Description Save a log snapshot
// @Tags snapshots
// @Accept json
// @Produce json
// @Param request body SaveSnapshotRequest true "Snapshot data"
// @Success 201 {object} storage.Snapshot
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/snapshots [post]
func (h *SnapshotsHandler) SaveSnapshot(c echo.Context) error {
	var req SaveSnapshotRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name is required"})
	}

	if len(req.Logs) > maxLogsPerSnapshot {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "too many logs (max 10000)"})
	}

	// Validate and truncate log messages
	for i := range req.Logs {
		if len(req.Logs[i].Message) > maxLogMessageSize {
			req.Logs[i].Message = req.Logs[i].Message[:maxLogMessageSize] + "..."
		}
	}

	snapshot, err := h.storage.SaveSnapshot(req.Name, req.Description, req.Containers, req.Levels, req.Logs)
	if err != nil {
		log.Printf("error saving snapshot: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save snapshot"})
	}

	SnapshotsSaved.Inc()
	return c.JSON(http.StatusCreated, snapshot)
}

// DeleteSnapshot handles DELETE /api/v1/snapshots/:id
// @Summary Delete snapshot
// @Description Delete a snapshot by ID
// @Tags snapshots
// @Param id path int true "Snapshot ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/snapshots/{id} [delete]
func (h *SnapshotsHandler) DeleteSnapshot(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid snapshot ID"})
	}

	if err := h.storage.DeleteSnapshot(id); err != nil {
		log.Printf("error deleting snapshot %d: %v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete snapshot"})
	}

	return c.NoContent(http.StatusNoContent)
}
