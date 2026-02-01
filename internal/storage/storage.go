package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/taslabs-net/loggarr/internal/models"
)

// Storage handles SQLite database operations
type Storage struct {
	db *sql.DB
}

// New creates a new Storage instance and initializes the database
func New(dataDir string) (*Storage, error) {
	// Ensure data directory exists with restricted permissions
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	dbPath := filepath.Join(dataDir, "loggarr.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}

	s := &Storage{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return s, nil
}

// Close closes the database connection
func (s *Storage) Close() error {
	return s.db.Close()
}

// migrate creates the required tables and runs migrations
func (s *Storage) migrate() error {
	// Create table if it doesn't exist
	schema := `
		CREATE TABLE IF NOT EXISTS snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			log_count INTEGER NOT NULL,
			containers TEXT NOT NULL,
			levels TEXT NOT NULL,
			logs TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at DESC);
	`
	if _, err := s.db.Exec(schema); err != nil {
		return err
	}

	// Add description column if it doesn't exist (migration for older databases)
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('snapshots') WHERE name='description'`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check for description column: %w", err)
	}
	if count == 0 {
		if _, err := s.db.Exec(`ALTER TABLE snapshots ADD COLUMN description TEXT`); err != nil {
			return fmt.Errorf("failed to add description column: %w", err)
		}
	}

	// Add log_count column if it doesn't exist (migration for older databases)
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('snapshots') WHERE name='log_count'`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check for log_count column: %w", err)
	}
	if count == 0 {
		if _, err := s.db.Exec(`ALTER TABLE snapshots ADD COLUMN log_count INTEGER NOT NULL DEFAULT 0`); err != nil {
			return fmt.Errorf("failed to add log_count column: %w", err)
		}
		// Backfill log_count from existing logs data
		if _, err := s.db.Exec(`UPDATE snapshots SET log_count = json_array_length(logs) WHERE log_count = 0`); err != nil {
			// Non-fatal: just log, the count will be 0 for old snapshots
			fmt.Printf("warning: failed to backfill log_count: %v\n", err)
		}
	}

	// Add containers column if it doesn't exist (migration for older databases)
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('snapshots') WHERE name='containers'`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check for containers column: %w", err)
	}
	if count == 0 {
		if _, err := s.db.Exec(`ALTER TABLE snapshots ADD COLUMN containers TEXT NOT NULL DEFAULT '[]'`); err != nil {
			return fmt.Errorf("failed to add containers column: %w", err)
		}
	}

	// Add levels column if it doesn't exist (migration for older databases)
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('snapshots') WHERE name='levels'`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check for levels column: %w", err)
	}
	if count == 0 {
		if _, err := s.db.Exec(`ALTER TABLE snapshots ADD COLUMN levels TEXT NOT NULL DEFAULT '[]'`); err != nil {
			return fmt.Errorf("failed to add levels column: %w", err)
		}
	}

	return nil
}

// Snapshot represents a saved log state
type Snapshot struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	LogCount    int               `json:"log_count"`
	Containers  []string          `json:"containers"`
	Levels      []string          `json:"levels"`
	Logs        []models.LogEntry `json:"logs,omitempty"`
}

// SaveSnapshot saves a log snapshot to the database
func (s *Storage) SaveSnapshot(name, description string, containers, levels []string, logs []models.LogEntry) (*Snapshot, error) {
	containersJSON, err := json.Marshal(containers)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal containers: %w", err)
	}

	levelsJSON, err := json.Marshal(levels)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal levels: %w", err)
	}

	logsJSON, err := json.Marshal(logs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal logs: %w", err)
	}

	result, err := s.db.Exec(
		`INSERT INTO snapshots (name, description, log_count, containers, levels, logs) VALUES (?, ?, ?, ?, ?, ?)`,
		name, description, len(logs), string(containersJSON), string(levelsJSON), string(logsJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert snapshot: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot ID: %w", err)
	}

	return &Snapshot{
		ID:          id,
		Name:        name,
		Description: description,
		CreatedAt:   time.Now(),
		LogCount:    len(logs),
		Containers:  containers,
		Levels:      levels,
	}, nil
}

// GetSnapshot retrieves a snapshot by ID (including logs)
func (s *Storage) GetSnapshot(id int64) (*Snapshot, error) {
	var snap Snapshot
	var containersJSON, levelsJSON, logsJSON string

	err := s.db.QueryRow(
		`SELECT id, name, COALESCE(description, ''), created_at, log_count, containers, levels, logs FROM snapshots WHERE id = ?`,
		id,
	).Scan(&snap.ID, &snap.Name, &snap.Description, &snap.CreatedAt, &snap.LogCount, &containersJSON, &levelsJSON, &logsJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	if err := json.Unmarshal([]byte(containersJSON), &snap.Containers); err != nil {
		return nil, fmt.Errorf("failed to unmarshal containers: %w", err)
	}
	if err := json.Unmarshal([]byte(levelsJSON), &snap.Levels); err != nil {
		return nil, fmt.Errorf("failed to unmarshal levels: %w", err)
	}
	if err := json.Unmarshal([]byte(logsJSON), &snap.Logs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal logs: %w", err)
	}

	return &snap, nil
}

// ListSnapshots returns all snapshots (without logs for efficiency)
func (s *Storage) ListSnapshots() ([]Snapshot, error) {
	rows, err := s.db.Query(
		`SELECT id, name, COALESCE(description, ''), created_at, log_count, containers, levels FROM snapshots ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list snapshots: %w", err)
	}
	defer rows.Close()

	var snapshots []Snapshot
	for rows.Next() {
		var snap Snapshot
		var containersJSON, levelsJSON string

		if err := rows.Scan(&snap.ID, &snap.Name, &snap.Description, &snap.CreatedAt, &snap.LogCount, &containersJSON, &levelsJSON); err != nil {
			return nil, fmt.Errorf("failed to scan snapshot: %w", err)
		}

		if err := json.Unmarshal([]byte(containersJSON), &snap.Containers); err != nil {
			return nil, fmt.Errorf("failed to unmarshal containers: %w", err)
		}
		if err := json.Unmarshal([]byte(levelsJSON), &snap.Levels); err != nil {
			return nil, fmt.Errorf("failed to unmarshal levels: %w", err)
		}

		snapshots = append(snapshots, snap)
	}

	return snapshots, rows.Err()
}

// DeleteSnapshot removes a snapshot by ID
func (s *Storage) DeleteSnapshot(id int64) error {
	result, err := s.db.Exec(`DELETE FROM snapshots WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete snapshot: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check deletion: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("snapshot not found")
	}

	return nil
}
