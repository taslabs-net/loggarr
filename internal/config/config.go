package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
)

// Version is set at build time
var Version = "dev"

// Config holds all configuration for the application
type Config struct {
	Port         string `env:"PORT" envDefault:"9797"`
	DataDir      string `env:"DATA_DIR" envDefault:"./data"`
	LogBufferMax int    `env:"LOG_BUFFER_MAX" envDefault:"1000"`
	LogTailLines string `env:"LOG_TAIL_LINES" envDefault:"10"`
	DockerSocket string `env:"DOCKER_SOCKET" envDefault:"/var/run/docker.sock"`
}

// Load parses environment variables into Config and validates values
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}

	// Validate config
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.LogBufferMax < 10 {
		return fmt.Errorf("LOG_BUFFER_MAX must be at least 10")
	}
	if c.LogBufferMax > 10000 {
		return fmt.Errorf("LOG_BUFFER_MAX cannot exceed 10000")
	}
	return nil
}
