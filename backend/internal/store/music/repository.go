package music

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

// GetConfig returns the singleton music configuration for the tenant database.
func (r *Repository) GetConfig(ctx context.Context, db *sql.DB) (*MusicConfigDTO, error) {
	query := `
		SELECT id, is_active, updated_at
		FROM music_config
		WHERE id = 1
		LIMIT 1;
	`
	var cfg MusicConfigDTO
	err := db.QueryRowContext(ctx, query).Scan(&cfg.ID, &cfg.IsActive, &cfg.UpdatedAt)
	if err == sql.ErrNoRows {
		// Initialize if missing
		initQuery := `
			INSERT INTO music_config (id, is_active, updated_at)
			VALUES (1, TRUE, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
			RETURNING id, is_active, updated_at;
		`
		err = db.QueryRowContext(ctx, initQuery).Scan(&cfg.ID, &cfg.IsActive, &cfg.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize music config: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to fetch music config: %w", err)
	}

	return &cfg, nil
}

// UpdateConfig updates the master active toggle in the singleton configuration.
func (r *Repository) UpdateConfig(ctx context.Context, db *sql.DB, isActive bool) (*MusicConfigDTO, error) {
	query := `
		INSERT INTO music_config (id, is_active, updated_at)
		VALUES (1, $1, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO UPDATE SET is_active = $1, updated_at = CURRENT_TIMESTAMP
		RETURNING id, is_active, updated_at;
	`
	var cfg MusicConfigDTO
	err := db.QueryRowContext(ctx, query, isActive).Scan(&cfg.ID, &cfg.IsActive, &cfg.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to update music config: %w", err)
	}
	return &cfg, nil
}

// ListTracks returns tracks. If activeOnly is true, only returns is_active=true tracks (for storefront).
func (r *Repository) ListTracks(ctx context.Context, db *sql.DB, activeOnly bool) ([]TrackDTO, error) {
	var query string
	if activeOnly {
		query = `
			SELECT id, title, audio_file, audio_url, is_active, sort_order, duration_seconds, created_at, updated_at
			FROM music_tracks
			WHERE is_active = TRUE
			ORDER BY sort_order ASC, created_at ASC;
		`
	} else {
		query = `
			SELECT id, title, audio_file, audio_url, is_active, sort_order, duration_seconds, created_at, updated_at
			FROM music_tracks
			ORDER BY sort_order ASC, created_at ASC;
		`
	}

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query music tracks: %w", err)
	}
	defer rows.Close()

	tracks := make([]TrackDTO, 0)
	for rows.Next() {
		var t TrackDTO
		var audioFile, audioURL sql.NullString
		var durationSec sql.NullInt64

		err := rows.Scan(
			&t.ID,
			&t.Title,
			&audioFile,
			&audioURL,
			&t.IsActive,
			&t.SortOrder,
			&durationSec,
			&t.CreatedAt,
			&t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan music track row: %w", err)
		}

		if audioFile.Valid && strings.TrimSpace(audioFile.String) != "" {
			af := audioFile.String
			t.AudioFile = &af
		}
		if audioURL.Valid && strings.TrimSpace(audioURL.String) != "" {
			au := audioURL.String
			t.AudioURL = &au
		}
		if durationSec.Valid {
			ds := int(durationSec.Int64)
			t.DurationSeconds = &ds
		}

		// Smart Audio Routing: Internal FileField > External URL
		if t.AudioFile != nil && *t.AudioFile != "" {
			t.ServedAudioURL = t.AudioFile
		} else if t.AudioURL != nil && *t.AudioURL != "" {
			t.ServedAudioURL = t.AudioURL
		}

		tracks = append(tracks, t)
	}

	return tracks, nil
}

// GetTrackByID retrieves a single track.
func (r *Repository) GetTrackByID(ctx context.Context, db *sql.DB, id string) (*TrackDTO, error) {
	query := `
		SELECT id, title, audio_file, audio_url, is_active, sort_order, duration_seconds, created_at, updated_at
		FROM music_tracks
		WHERE id = $1
		LIMIT 1;
	`
	var t TrackDTO
	var audioFile, audioURL sql.NullString
	var durationSec sql.NullInt64

	err := db.QueryRowContext(ctx, query, id).Scan(
		&t.ID,
		&t.Title,
		&audioFile,
		&audioURL,
		&t.IsActive,
		&t.SortOrder,
		&durationSec,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed to fetch track: %w", err)
	}

	if audioFile.Valid && strings.TrimSpace(audioFile.String) != "" {
		af := audioFile.String
		t.AudioFile = &af
	}
	if audioURL.Valid && strings.TrimSpace(audioURL.String) != "" {
		au := audioURL.String
		t.AudioURL = &au
	}
	if durationSec.Valid {
		ds := int(durationSec.Int64)
		t.DurationSeconds = &ds
	}

	if t.AudioFile != nil && *t.AudioFile != "" {
		t.ServedAudioURL = t.AudioFile
	} else if t.AudioURL != nil && *t.AudioURL != "" {
		t.ServedAudioURL = t.AudioURL
	}

	return &t, nil
}

// CreateTrack inserts a new audio track.
func (r *Repository) CreateTrack(ctx context.Context, db *sql.DB, t *CreateTrackRequest) (*TrackDTO, error) {
	var nextSort int
	_ = db.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_order), -1) + 1 FROM music_tracks`).Scan(&nextSort)
	sortOrder := nextSort
	if t.SortOrder != nil {
		sortOrder = *t.SortOrder
	}

	isActive := true
	if t.IsActive != nil {
		isActive = *t.IsActive
	}

	query := `
		INSERT INTO music_tracks (title, audio_file, audio_url, is_active, sort_order, duration_seconds, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, title, audio_file, audio_url, is_active, sort_order, duration_seconds, created_at, updated_at;
	`

	var created TrackDTO
	var audioFile, audioURL sql.NullString
	var durationSec sql.NullInt64

	err := db.QueryRowContext(ctx, query, t.Title, t.AudioFile, t.AudioURL, isActive, sortOrder, t.DurationSeconds).Scan(
		&created.ID,
		&created.Title,
		&audioFile,
		&audioURL,
		&created.IsActive,
		&created.SortOrder,
		&durationSec,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create track: %w", err)
	}

	if audioFile.Valid && strings.TrimSpace(audioFile.String) != "" {
		af := audioFile.String
		created.AudioFile = &af
	}
	if audioURL.Valid && strings.TrimSpace(audioURL.String) != "" {
		au := audioURL.String
		created.AudioURL = &au
	}
	if durationSec.Valid {
		ds := int(durationSec.Int64)
		created.DurationSeconds = &ds
	}

	if created.AudioFile != nil && *created.AudioFile != "" {
		created.ServedAudioURL = created.AudioFile
	} else if created.AudioURL != nil && *created.AudioURL != "" {
		created.ServedAudioURL = created.AudioURL
	}

	return &created, nil
}

// UpdateTrack updates track details.
func (r *Repository) UpdateTrack(ctx context.Context, db *sql.DB, id string, req *UpdateTrackRequest) (*TrackDTO, error) {
	existing, err := r.GetTrackByID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("track not found")
	}

	title := existing.Title
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	audioFile := existing.AudioFile
	if req.AudioFile != nil {
		audioFile = req.AudioFile
	}
	audioURL := existing.AudioURL
	if req.AudioURL != nil {
		audioURL = req.AudioURL
	}
	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	sortOrder := existing.SortOrder
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	durationSec := existing.DurationSeconds
	if req.DurationSeconds != nil {
		durationSec = req.DurationSeconds
	}

	query := `
		UPDATE music_tracks
		SET title = $1, audio_file = $2, audio_url = $3, is_active = $4, sort_order = $5, duration_seconds = $6, updated_at = CURRENT_TIMESTAMP
		WHERE id = $7
		RETURNING id, title, audio_file, audio_url, is_active, sort_order, duration_seconds, created_at, updated_at;
	`

	var updated TrackDTO
	var scannedAudioFile, scannedAudioURL sql.NullString
	var scannedDurationSec sql.NullInt64

	err = db.QueryRowContext(ctx, query, title, audioFile, audioURL, isActive, sortOrder, durationSec, id).Scan(
		&updated.ID,
		&updated.Title,
		&scannedAudioFile,
		&scannedAudioURL,
		&updated.IsActive,
		&updated.SortOrder,
		&scannedDurationSec,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update track: %w", err)
	}

	if scannedAudioFile.Valid && strings.TrimSpace(scannedAudioFile.String) != "" {
		af := scannedAudioFile.String
		updated.AudioFile = &af
	}
	if scannedAudioURL.Valid && strings.TrimSpace(scannedAudioURL.String) != "" {
		au := scannedAudioURL.String
		updated.AudioURL = &au
	}
	if scannedDurationSec.Valid {
		ds := int(scannedDurationSec.Int64)
		updated.DurationSeconds = &ds
	}

	if updated.AudioFile != nil && *updated.AudioFile != "" {
		updated.ServedAudioURL = updated.AudioFile
	} else if updated.AudioURL != nil && *updated.AudioURL != "" {
		updated.ServedAudioURL = updated.AudioURL
	}

	return &updated, nil
}

// DeleteTrack removes a track.
func (r *Repository) DeleteTrack(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM music_tracks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete track: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("track not found")
	}
	return nil
}

// ReorderTracks updates the sort_order of the given tracks in sequence.
func (r *Repository) ReorderTracks(ctx context.Context, db *sql.DB, trackIDs []string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for idx, id := range trackIDs {
		_, err := tx.ExecContext(ctx, `UPDATE music_tracks SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, idx+1, id)
		if err != nil {
			return fmt.Errorf("failed to update sort order for track %s: %w", id, err)
		}
	}

	return tx.Commit()
}
