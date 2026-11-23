import { fetchStorefrontData } from './api';
import type { StorefrontMusicConfig, StorefrontMusicTrack } from '../types/music';

/**
 * Fetch the ambient music feature configuration for the storefront.
 */
export async function getStorefrontMusicConfig(host: string): Promise<StorefrontMusicConfig> {
  return await fetchStorefrontData<StorefrontMusicConfig>(host, '/storefront/music/config', {
    cache: 'no-store',
  });
}

/**
 * Fetch active ambient soundtrack playlist for the storefront.
 */
export async function getStorefrontMusicTracks(host: string): Promise<StorefrontMusicTrack[]> {
  return await fetchStorefrontData<StorefrontMusicTrack[]>(host, '/storefront/music/tracks', {
    cache: 'no-store',
  });
}
