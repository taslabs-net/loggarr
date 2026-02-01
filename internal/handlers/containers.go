package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/taslabs-net/loggarr/internal/docker"
)

// ContainersHandler handles container-related endpoints
type ContainersHandler struct {
	dockerClient *docker.Client
}

// NewContainersHandler creates a new containers handler
func NewContainersHandler(dc *docker.Client) *ContainersHandler {
	return &ContainersHandler{dockerClient: dc}
}

// ListContainers handles GET /api/v1/containers
// @Summary List containers
// @Description Get list of all Docker containers
// @Tags containers
// @Produce json
// @Success 200 {array} models.Container
// @Failure 500 {object} map[string]string
// @Router /v1/containers [get]
func (h *ContainersHandler) ListContainers(c echo.Context) error {
	containers, err := h.dockerClient.ListContainers(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}
	return c.JSON(http.StatusOK, containers)
}
