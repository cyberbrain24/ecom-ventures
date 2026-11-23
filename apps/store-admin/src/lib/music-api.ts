import { authorizedRequest } from './api';
import type { MusicConfig, MusicTrack, CreateMusicTrackRequest, UpdateMusicTrackRequest } from '../types/store';

/**
 * Fetch singleton ambient music configuration for the store.
 */
export async function fetchMusicConfig(): Promise<MusicConfig> {
  return await authorizedRequest<MusicConfig>('/music/config', { method: 'GET' });
}

/**
 * Toggle the master storefront music feature ON / OFF.
 */
export async function updateMusicConfig(isActive: boolean): Promise<MusicConfig> {
  return await authorizedRequest<MusicConfig>('/music/config', {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  });
}

/**
 * List all audio tracks in the store library.
 */
export async function fetchMusicTracks(): Promise<MusicTrack[]> {
  return await authorizedRequest<MusicTrack[]>('/music/tracks', { method: 'GET' });
}

/**
 * Create a new audio track.
 */
export async function createMusicTrack(payload: CreateMusicTrackRequest): Promise<MusicTrack> {
  return await authorizedRequest<MusicTrack>('/music/tracks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing audio track.
 */
export async function updateMusicTrack(id: string, payload: UpdateMusicTrackRequest): Promise<MusicTrack> {
  return await authorizedRequest<MusicTrack>(`/music/tracks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a track from the library.
 */
export async function deleteMusicTrack(id: string): Promise<void> {
  await authorizedRequest<{ message: string }>(`/music/tracks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Batch reorder tracks by their IDs.
 */
export async function reorderMusicTracks(trackIds: string[]): Promise<void> {
  await authorizedRequest<{ message: string }>('/music/tracks/reorder', {
    method: 'POST',
    body: JSON.stringify({ track_ids: trackIds }),
  });
}

/**
 * Upload an MP3 or OGG audio file (Max 10MB) to VPS media storage.
 */
export async function uploadTrackAudio(file: File): Promise<{ url: string; key: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await authorizedRequest<{ url: string; key: string; size: number }>('/music/upload', {
    method: 'POST',
    body: formData,
  });
  return res;
}
