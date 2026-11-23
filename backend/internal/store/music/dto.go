package music

import (
	"time"
)

// MusicConfigDTO represents the singleton configuration of the ambient music feature.
type MusicConfigDTO struct {
	ID        int       `json:"id"`
	IsActive  bool      `json:"is_active"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateMusicConfigRequest is the payload sent from admin to toggle the music master switch.
type UpdateMusicConfigRequest struct {
	IsActive bool `json:"is_active"`
}

// TrackDTO represents an ambient music track item in the store catalog library.
type TrackDTO struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	AudioFile       *string   `json:"audio_file,omitempty"`
	AudioURL        *string   `json:"audio_url,omitempty"`
	ServedAudioURL  *string   `json:"served_audio_url,omitempty"`
	IsActive        bool      `json:"is_active"`
	SortOrder       int       `json:"sort_order"`
	DurationSeconds *int      `json:"duration_seconds,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CreateTrackRequest is the form/JSON payload for registering or updating a track.
type CreateTrackRequest struct {
	Title           string  `json:"title"`
	AudioFile       *string `json:"audio_file,omitempty"`
	AudioURL        *string `json:"audio_url,omitempty"`
	IsActive        *bool   `json:"is_active,omitempty"`
	SortOrder       *int    `json:"sort_order,omitempty"`
	DurationSeconds *int    `json:"duration_seconds,omitempty"`
}

// UpdateTrackRequest is the payload for updating an existing track.
type UpdateTrackRequest struct {
	Title           *string `json:"title,omitempty"`
	AudioFile       *string `json:"audio_file,omitempty"`
	AudioURL        *string `json:"audio_url,omitempty"`
	IsActive        *bool   `json:"is_active,omitempty"`
	SortOrder       *int    `json:"sort_order,omitempty"`
	DurationSeconds *int    `json:"duration_seconds,omitempty"`
}

// ReorderTracksRequest allows batch sorting.
type ReorderTracksRequest struct {
	TrackIDs []string `json:"track_ids"`
}
