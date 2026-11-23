'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useMusic } from '../../context/MusicContext';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  ListMusic,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';

export const FloatingPlayer: React.FC = () => {
  const pathname = usePathname();
  const {
    isConfigActive,
    tracks,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    isLooping,
    currentTime,
    duration,
    togglePlay,
    playTrack,
    nextTrack,
    prevTrack,
    toggleLoop,
    seek,
  } = useMusic();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const playerRef = useRef<HTMLDivElement | null>(null);

  // Checkout Distraction-Free Isolation:
  // Strip music player when customers enter /checkout to eliminate distractions and boost conversion.
  const isCheckout = pathname?.startsWith('/checkout');

  // Click-Outside Minimization for Mobile & Desktop
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (playerRef.current && !playerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setShowPlaylist(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  if (!isConfigActive || tracks.length === 0 || isCheckout) {
    return null;
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={playerRef}
      className="fixed z-50 transition-all duration-300 ease-in-out font-sans select-none"
      style={{
        // Positioning: Pinned smoothly to left edge on desktop; docked right above bottom nav on mobile
        ...(isExpanded
          ? {
              left: '50%',
              bottom: '84px',
              transform: 'translateX(-50%)',
              width: '92%',
              maxWidth: '380px',
            }
          : {
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
            }),
      }}
    >
      {/* STATE 1: MINIMIZED FLOATING BADGE */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          aria-label="Open Ambient Music Player"
          className="group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(20, 20, 22, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          }}
        >
          {/* Subtle Rotating Visualizer Ring when Playing */}
          <div
            className={`absolute inset-0 rounded-full border border-dashed border-white/40 transition-all ${
              isPlaying ? 'animate-spin' : 'opacity-30'
            }`}
            style={{ animationDuration: '10s' }}
          />

          <div className="relative flex items-center justify-center text-white">
            <Music size={22} className={isPlaying ? 'text-[var(--brand-primary,#6366f1)]' : 'text-white/80'} />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary,#6366f1)] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--brand-primary,#6366f1)]" />
              </span>
            )}
          </div>
        </button>
      )}

      {/* STATE 2: MAXIMIZED FROSTED GLASS CONTROLLER */}
      {isExpanded && (
        <div
          className="relative rounded-2xl p-5 shadow-2xl text-white overflow-hidden transition-all duration-300"
          style={{
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            backgroundColor: 'rgba(18, 18, 20, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
          }}
        >
          {/* Top Bar: Close Button */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--brand-primary,#6366f1)] animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/50">
                Ambient Soundscape
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Minimize Player"
            >
              <X size={16} />
            </button>
          </div>

          {/* Track Info */}
          <div className="text-center mb-4 px-2">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white truncate">
              {currentTrack?.title || 'Ambient Track'}
            </h4>
            <div className="text-[11px] text-white/50 tracking-tight mt-0.5">
              Track {currentTrackIndex + 1} of {tracks.length}
            </div>
          </div>

          {/* Scrub Slider & Timestamps */}
          <div className="mb-4">
            <div className="relative w-full h-1.5 bg-white/10 rounded-full cursor-pointer group mb-1.5">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime || 0}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="h-full rounded-full bg-[var(--brand-primary,#6366f1)] relative transition-all"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls Dock */}
          <div className="flex items-center justify-between px-2">
            {/* Loop Toggle */}
            <button
              onClick={toggleLoop}
              className={`p-2 rounded-lg transition-colors ${
                isLooping
                  ? 'text-[var(--brand-primary,#6366f1)] bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title={isLooping ? 'Looping enabled' : 'Loop disabled'}
            >
              <Repeat size={16} />
            </button>

            {/* Prev Track */}
            <button
              onClick={prevTrack}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition-colors"
              title="Previous Track"
            >
              <SkipBack size={18} />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full flex items-center justify-center text-black bg-white hover:scale-105 active:scale-95 transition-transform shadow-lg"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>

            {/* Next Track */}
            <button
              onClick={nextTrack}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition-colors"
              title="Next Track"
            >
              <SkipForward size={18} />
            </button>

            {/* Playlist Drawer Toggle */}
            <button
              onClick={() => setShowPlaylist((prev) => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                showPlaylist
                  ? 'text-[var(--brand-primary,#6366f1)] bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Playlist Drawer"
            >
              <ListMusic size={18} />
            </button>
          </div>

          {/* Playlist Drawer */}
          {showPlaylist && (
            <div className="mt-4 pt-3 border-t border-white/10 max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-2 px-1">
                Playlist ({tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'})
              </div>
              {tracks.map((t, idx) => {
                const isSelected = idx === currentTrackIndex;
                return (
                  <button
                    key={t.id}
                    onClick={() => playTrack(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-mono text-white/40">{idx + 1}.</span>
                      <span className="truncate">{t.title}</span>
                    </div>
                    {isSelected && isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-[var(--brand-primary,#6366f1)] animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
