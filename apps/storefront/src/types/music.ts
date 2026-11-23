export interface StorefrontMusicConfig {
  id: number;
  is_active: boolean;
  updated_at: string;
}

export interface StorefrontMusicTrack {
  id: string;
  title: string;
  audio_file?: string | null;
  audio_url?: string | null;
  served_audio_url?: string | null;
  is_active: boolean;
  sort_order: number;
  duration_seconds?: number | null;
  created_at: string;
  updated_at: string;
}
