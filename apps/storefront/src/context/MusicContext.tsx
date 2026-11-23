'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { StorefrontMusicTrack, StorefrontMusicConfig } from '../types/music';

interface MusicContextValue {
  isConfigActive: boolean;
  tracks: StorefrontMusicTrack[];
  currentTrackIndex: number;
  currentTrack: StorefrontMusicTrack | null;
  isPlaying: boolean;
  isLooping: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  isReady: boolean;
  playTrack: (index?: number) => void;
  pauseTrack: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLoop: () => void;
  seek: (seconds: number) => void;
  setVolume: (level: number) => void;
}

const MusicContext = createContext<MusicContextValue | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConfigActive, setIsConfigActive] = useState<boolean>(false);
  const [tracks, setTracks] = useState<StorefrontMusicTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 7-Second Performance Guardrail:
  // Defers querying music API and downloading any audio metadata until after critical fonts, CSS, and hero images finish loading.
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    // Check sessionStorage cache first for seamless subpage navigation
    const cachedConfig = sessionStorage.getItem('poshplex_music_config');
    const cachedTracks = sessionStorage.getItem('poshplex_music_tracks');

    if (cachedConfig && cachedTracks) {
      try {
        const parsedConfig: StorefrontMusicConfig = JSON.parse(cachedConfig);
        const parsedTracks: StorefrontMusicTrack[] = JSON.parse(cachedTracks);
        if (parsedConfig.is_active && parsedTracks.length > 0) {
          setIsConfigActive(true);
          setTracks(parsedTracks);
          setIsReady(true);
          return;
        }
      } catch {
        // Fallback to fetch
      }
    }

    timerId = setTimeout(async () => {
      if (isCancelled) return;

      try {
        const host = window.location.host;
        // In client-side fetch, query current domain's API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

        const [configRes, tracksRes] = await Promise.all([
          fetch(`${apiUrl}/api/v1/storefront/music/config`, {
            headers: { 'X-Storefront-Host': host },
          }),
          fetch(`${apiUrl}/api/v1/storefront/music/tracks`, {
            headers: { 'X-Storefront-Host': host },
          }),
        ]);

        if (!configRes.ok || !tracksRes.ok) {
          setIsConfigActive(false);
          setIsReady(true);
          return;
        }

        const configJson = await configRes.json();
        const tracksJson = await tracksRes.json();

        const configData: StorefrontMusicConfig = configJson.data || configJson;
        const tracksData: StorefrontMusicTrack[] = tracksJson.data || tracksJson || [];

        if (configData.is_active && tracksData.length > 0) {
          setIsConfigActive(true);
          setTracks(tracksData);
          sessionStorage.setItem('poshplex_music_config', JSON.stringify(configData));
          sessionStorage.setItem('poshplex_music_tracks', JSON.stringify(tracksData));
        } else {
          setIsConfigActive(false);
          sessionStorage.removeItem('poshplex_music_config');
          sessionStorage.removeItem('poshplex_music_tracks');
        }
      } catch {
        setIsConfigActive(false);
      } finally {
        if (!isCancelled) {
          setIsReady(true);
        }
      }
    }, 7000); // 7-second guardrail delay

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // Initialize Audio Element
  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'metadata';

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 0);
      };

      audio.onended = () => {
        if (isLooping) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          // Play next track or pause if last
          setCurrentTrackIndex((prev) => {
            const nextIdx = (prev + 1) % tracks.length;
            return nextIdx;
          });
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [tracks, isLooping]);

  // Handle track stream URL updates
  const currentTrack = tracks[currentTrackIndex] || null;

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      const stream = currentTrack.served_audio_url || currentTrack.audio_file || currentTrack.audio_url;
      if (stream && audioRef.current.src !== stream) {
        audioRef.current.src = stream;
        if (isPlaying) {
          audioRef.current.play().catch(() => {
            setIsPlaying(false);
          });
        }
      }
    }
  }, [currentTrackIndex, tracks]);

  const playTrack = (index?: number) => {
    if (index !== undefined && index >= 0 && index < tracks.length) {
      setCurrentTrackIndex(index);
    }
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      pauseTrack();
    } else {
      playTrack();
    }
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    const nextIdx = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIdx);
    if (audioRef.current) {
      const nextStream = tracks[nextIdx].served_audio_url || tracks[nextIdx].audio_file || tracks[nextIdx].audio_url;
      if (nextStream) {
        audioRef.current.src = nextStream;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    // If more than 3 seconds in, replay current track
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(prevIdx);
    if (audioRef.current) {
      const prevStream = tracks[prevIdx].served_audio_url || tracks[prevIdx].audio_file || tracks[prevIdx].audio_url;
      if (prevStream) {
        audioRef.current.src = prevStream;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const toggleLoop = () => {
    setIsLooping((prev) => !prev);
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (level: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, level));
      setIsMuted(level === 0);
    }
  };

  return (
    <MusicContext.Provider
      value={{
        isConfigActive,
        tracks,
        currentTrackIndex,
        currentTrack,
        isPlaying,
        isLooping,
        isMuted,
        currentTime,
        duration,
        isReady,
        playTrack,
        pauseTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        toggleLoop,
        seek,
        setVolume,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};
