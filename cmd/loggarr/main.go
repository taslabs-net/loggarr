// @title Loggarr API
// @version 1.0
// @description Docker container log viewer and aggregator
// @license.name MIT
// @license.url https://github.com/taslabs-net/loggarr/blob/main/LICENSE
// @host localhost:9797
// @BasePath /api
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	echoSwagger "github.com/swaggo/echo-swagger"

	"github.com/taslabs-net/loggarr/internal/config"
	"github.com/taslabs-net/loggarr/internal/docker"
	"github.com/taslabs-net/loggarr/internal/handlers"
	"github.com/taslabs-net/loggarr/internal/storage"

	_ "github.com/taslabs-net/loggarr/docs" // swagger docs
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	printBanner(cfg)

	// Create Docker client
	dockerClient, err := docker.NewClient(cfg.LogTailLines)
	if err != nil {
		log.Fatalf("Failed to create Docker client: %v", err)
	}
	defer dockerClient.Close()

	// Test Docker connection
	ctx := context.Background()
	if err := dockerClient.Ping(ctx); err != nil {
		log.Fatalf("Failed to connect to Docker: %v", err)
	}
	fmt.Println("Connected to Docker")

	// List containers
	containers, err := dockerClient.ListContainers(ctx)
	if err != nil {
		log.Fatalf("Failed to list containers: %v", err)
	}
	fmt.Printf("Found %d containers\n", len(containers))
	handlers.ContainersMonitored.Set(float64(len(containers)))

	// Initialize storage
	store, err := storage.New(cfg.DataDir)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()
	fmt.Println("Database initialized")

	// Create Echo server
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	// Middleware
	e.Use(middleware.Recover())
	e.Use(middleware.Logger())
	e.Use(middleware.BodyLimit("2M"))                                       // Limit request body size
	e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(20))) // 20 req/sec
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{}, // Same-origin only (empty = no CORS headers)
	}))

	// Create handlers
	logsHandler := handlers.NewLogsHandler(dockerClient)
	containersHandler := handlers.NewContainersHandler(dockerClient)
	healthHandler := handlers.NewHealthHandler(dockerClient)
	snapshotsHandler := handlers.NewSnapshotsHandler(store)
	pagesHandler := handlers.NewPagesHandler(dockerClient, cfg)

	// Static files
	e.Static("/static", "static")

	// Pages
	e.GET("/", pagesHandler.Index)

	// API routes
	api := e.Group("/api")
	api.GET("/health", healthHandler.Health)
	api.GET("/metrics", handlers.MetricsHandler())
	api.GET("/docs/*", echoSwagger.WrapHandler)

	v1 := api.Group("/v1")
	v1.GET("/logs", logsHandler.StreamLogs)
	v1.GET("/containers", containersHandler.ListContainers)
	v1.GET("/snapshots", snapshotsHandler.ListSnapshots)
	v1.GET("/snapshots/:id", snapshotsHandler.GetSnapshot)
	v1.POST("/snapshots", snapshotsHandler.SaveSnapshot)
	v1.DELETE("/snapshots/:id", snapshotsHandler.DeleteSnapshot)

	// Start server in goroutine
	go func() {
		addr := fmt.Sprintf(":%s", cfg.Port)
		fmt.Printf("Server starting on http://localhost%s\n", addr)
		if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println("\nShutting down...")

	// Graceful shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
}

func printBanner(cfg *config.Config) {
	fmt.Println(`
 _                                  
| |    ___   __ _  __ _  __ _ _ __ _ __ 
| |   / _ \ / _' |/ _' |/ _' | '__| '__|
| |__| (_) | (_| | (_| | (_| | |  | |   
|_____\___/ \__, |\__, |\__,_|_|  |_|   
            |___/ |___/                 
`)
	fmt.Printf("Docker Log Viewer v%s - Port %s\n\n", config.Version, cfg.Port)
}
