package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"

	"github.com/taslabs-net/loggarr/internal/models"
)

// Client wraps the Docker client
type Client struct {
	cli       *client.Client
	tailLines string
}

// NewClient creates a new Docker client
func NewClient(tailLines string) (*Client, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	if tailLines == "" {
		tailLines = "10"
	}
	return &Client{cli: cli, tailLines: tailLines}, nil
}

// Close closes the Docker client
func (c *Client) Close() error {
	return c.cli.Close()
}

// Ping checks if Docker is available
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.cli.Ping(ctx)
	return err
}

// ListContainers returns all containers
func (c *Client) ListContainers(ctx context.Context) ([]models.Container, error) {
	containers, err := c.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	result := make([]models.Container, len(containers))
	for i, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = c.Names[0]
			if len(name) > 0 && name[0] == '/' {
				name = name[1:]
			}
		}
		result[i] = models.Container{
			ID:     c.ID,
			Name:   name,
			Image:  c.Image,
			State:  c.State,
			Status: c.Status,
		}
	}
	return result, nil
}

// GetRunningContainers returns only running containers
func (c *Client) GetRunningContainers(ctx context.Context) ([]types.Container, error) {
	f := filters.NewArgs()
	f.Add("status", "running")
	return c.cli.ContainerList(ctx, container.ListOptions{
		Filters: f,
	})
}

// GetClient returns the underlying Docker client for direct access
func (c *Client) GetClient() *client.Client {
	return c.cli
}

// StreamEvents streams Docker container events
func (c *Client) StreamEvents(ctx context.Context, eventChan chan<- models.ContainerEvent) error {
	f := filters.NewArgs()
	f.Add("type", "container")

	msgChan, errChan := c.cli.Events(ctx, events.ListOptions{Filters: f})

	go func() {
		defer close(eventChan)
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-errChan:
				if err != nil {
					return
				}
			case msg := <-msgChan:
				name := msg.Actor.Attributes["name"]
				eventChan <- models.ContainerEvent{
					ID:     msg.Actor.ID,
					Name:   name,
					Action: string(msg.Action),
					Time:   msg.Time,
				}
			}
		}
	}()

	return nil
}
