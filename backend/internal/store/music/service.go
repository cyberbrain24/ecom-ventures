package music

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"ecom-ventures/backend/pkg/storage"
	storeCtx "ecom-ventures/backend/internal/store/context"
)

type Service struct {
	repo    *Repository
	storage storage.ObjectStorage
}

func NewService(repo *Repository, storage storage.ObjectStorage) *Service {
	return &Service{
		repo:    repo,
		storage: storage,
	}
}

func (s *Service) GetConfig(ctx context.Context, db *sql.DB) (*MusicConfigDTO, error) {
	return s.repo.GetConfig(ctx, db)
}

func (s *Service) UpdateConfig(ctx context.Context, db *sql.DB, isActive bool) (*MusicConfigDTO, error) {
	return s.repo.UpdateConfig(ctx, db, isActive)
}

func (s *Service) ListTracks(ctx context.Context, db *sql.DB, activeOnly bool) ([]TrackDTO, error) {
	return s.repo.ListTracks(ctx, db, activeOnly)
}

func (s *Service) GetTrack(ctx context.Context, db *sql.DB, id string) (*TrackDTO, error) {
	return s.repo.GetTrackByID(ctx, db, id)
}

func (s *Service) CreateTrack(ctx context.Context, db *sql.DB, req *CreateTrackRequest) (*TrackDTO, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("track title is required")
	}
	req.Title = title

	if (req.AudioFile == nil || *req.AudioFile == "") && (req.AudioURL == nil || *req.AudioURL == "") {
		return nil, errors.New("either an uploaded audio file or external audio URL must be provided")
	}

	return s.repo.CreateTrack(ctx, db, req)
}

func (s *Service) UpdateTrack(ctx context.Context, db *sql.DB, id string, req *UpdateTrackRequest) (*TrackDTO, error) {
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, errors.New("track title cannot be empty")
		}
		req.Title = &title
	}
	return s.repo.UpdateTrack(ctx, db, id, req)
}

func (s *Service) DeleteTrack(ctx context.Context, db *sql.DB, id string) error {
	existing, err := s.repo.GetTrackByID(ctx, db, id)
	if err != nil {
		return err
	}
	if existing != nil && existing.AudioFile != nil && s.storage != nil {
		// Clean up uploaded file if present
		// Extract storage key from relative path or URL
		url := *existing.AudioFile
		if strings.Contains(url, "/uploads/") {
			parts := strings.Split(url, "/uploads/")
			if len(parts) == 2 {
				_ = s.storage.Delete(ctx, parts[1])
			}
		}
	}
	return s.repo.DeleteTrack(ctx, db, id)
}

func (s *Service) ReorderTracks(ctx context.Context, db *sql.DB, trackIDs []string) error {
	return s.repo.ReorderTracks(ctx, db, trackIDs)
}

// UploadAudioFile handles streaming an MP3 or OGG audio payload into storage and returns the URL.
func (s *Service) UploadAudioFile(ctx context.Context, filename string, contentType string, reader io.Reader, size int64) (*storage.UploadResult, error) {
	if s.storage == nil {
		return nil, errors.New("object storage provider is not initialized")
	}

	cleanType := strings.ToLower(strings.TrimSpace(contentType))
	// Verify audio mime or extension
	ext := strings.ToLower(filepath.Ext(filename))
	if cleanType == "application/octet-stream" || cleanType == "" {
		if ext == ".mp3" {
			cleanType = "audio/mpeg"
		} else if ext == ".ogg" {
			cleanType = "audio/ogg"
		}
	}

	if cleanType != "audio/mpeg" && cleanType != "audio/mp3" && cleanType != "audio/ogg" && cleanType != "audio/vorbis" && cleanType != "application/ogg" {
		return nil, fmt.Errorf("invalid audio format: only MP3 and OGG audio files are supported (received %s)", cleanType)
	}

	folder := "music/tracks"
	if sc, err := storeCtx.GetStoreContext(ctx); err == nil && sc != nil && sc.Store != nil {
		folder = storage.BuildStorePath(sc.Store.Slug, storage.ModuleMusic, "tracks")
	}

	return s.storage.Save(ctx, folder, filename, cleanType, reader, size)
}
