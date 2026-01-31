package handlers

import (
	"github.com/labstack/echo/v4"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// LogsStreamed counts total logs streamed
	LogsStreamed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "loggarr_logs_streamed_total",
			Help: "Total number of logs streamed",
		},
		[]string{"container", "level"},
	)

	// ActiveConnections tracks current SSE connections
	ActiveConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "loggarr_active_connections",
			Help: "Number of active SSE connections",
		},
	)

	// SnapshotsSaved counts snapshots saved
	SnapshotsSaved = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "loggarr_snapshots_saved_total",
			Help: "Total number of snapshots saved",
		},
	)

	// ContainersMonitored tracks containers being monitored
	ContainersMonitored = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "loggarr_containers_monitored",
			Help: "Number of containers being monitored",
		},
	)
)

func init() {
	prometheus.MustRegister(LogsStreamed)
	prometheus.MustRegister(ActiveConnections)
	prometheus.MustRegister(SnapshotsSaved)
	prometheus.MustRegister(ContainersMonitored)
}

// MetricsHandler returns the Prometheus metrics handler
func MetricsHandler() echo.HandlerFunc {
	h := promhttp.Handler()
	return func(c echo.Context) error {
		h.ServeHTTP(c.Response(), c.Request())
		return nil
	}
}
