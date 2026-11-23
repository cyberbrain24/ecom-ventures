package music

import (
	"context"
	"database/sql"
	"strings"
	"testing"
)

type dummyStorage struct{}

func (d *dummyStorage) Save(ctx context.Context, folder, filename, contentType string, reader interface{}, size int64) error {
	return nil
}

func TestValidation(t *testing.T) {
	repo := NewRepository()
	svc := NewService(repo, nil)

	var db *sql.DB
	_, err := svc.CreateTrack(context.Background(), db, &CreateTrackRequest{
		Title: "  ",
	})
	if err == nil || !strings.Contains(err.Error(), "track title is required") {
		t.Fatalf("expected title validation error, got %v", err)
	}

	_, err = svc.CreateTrack(context.Background(), db, &CreateTrackRequest{
		Title: "Ambient Sunset",
	})
	if err == nil || !strings.Contains(err.Error(), "either an uploaded audio file or external audio URL must be provided") {
		t.Fatalf("expected audio source validation error, got %v", err)
	}
}
