package handlers

import (
	"github.com/labstack/echo/v4"

	"github.com/taslabs-net/loggarr/internal/config"
	"github.com/taslabs-net/loggarr/internal/docker"
	"github.com/taslabs-net/loggarr/internal/templates"
)

// PagesHandler handles page rendering
type PagesHandler struct {
	dockerClient *docker.Client
	config       *config.Config
}

// NewPagesHandler creates a new pages handler
func NewPagesHandler(dc *docker.Client, cfg *config.Config) *PagesHandler {
	return &PagesHandler{dockerClient: dc, config: cfg}
}

// Index handles GET / - renders the main page
func (h *PagesHandler) Index(c echo.Context) error {
	containers, err := h.dockerClient.ListContainers(c.Request().Context())
	if err != nil {
		containers = nil // Continue with empty list
	}

	return templates.Index(containers, h.config.LogBufferMax, config.Version).Render(c.Request().Context(), c.Response())
}
