-- 000028_music_system.up.sql
-- Ambient Music System: Track Library and MusicConfig Singleton

CREATE TABLE IF NOT EXISTS music_config (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed singleton row if not exists
INSERT INTO music_config (id, is_active, updated_at)
VALUES (1, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS music_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    audio_file TEXT,
    audio_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_sort_active ON music_tracks(is_active, sort_order ASC, created_at ASC);
