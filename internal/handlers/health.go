package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/taslabs-net/loggarr/internal/docker"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	dockerClient *docker.Client
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(dc *docker.Client) *HealthHandler {
	return &HealthHandler{dockerClient: dc}
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status string `json:"status"`
	Docker bool   `json:"docker"`
}

// Health handles GET /api/health
func (h *HealthHandler) Health(c echo.Context) error {
	dockerOK := false
	if err := h.dockerClient.Ping(c.Request().Context()); err == nil {
		dockerOK = true
	}

	status := "healthy"
	httpStatus := http.StatusOK
	if !dockerOK {
		status = "unhealthy"
		httpStatus = http.StatusServiceUnavailable
	}

	return c.JSON(httpStatus, HealthResponse{
		Status: status,
		Docker: dockerOK,
	})
}
