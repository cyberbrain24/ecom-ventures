import React, { useState, useEffect, useRef } from 'react';
import {
  Headphones,
  Power,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  RefreshCw,
  Music,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  Volume2,
  ArrowUp,
  ArrowDown,
  Globe,
  Radio,
} from 'lucide-react';
import type { StoreBrand, MusicTrack } from '../types/store';
import {
  fetchMusicConfig,
  updateMusicConfig,
  fetchMusicTracks,
  createMusicTrack,
  updateMusicTrack,
  deleteMusicTrack,
  reorderMusicTracks,
  uploadTrackAudio,
} from '../lib/music-api';

interface MusicModuleProps {
  currentStore: StoreBrand;
}

export const MusicModule: React.FC<MusicModuleProps> = ({ currentStore }) => {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Audio preview state
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formAudioFileUrl, setFormAudioFileUrl] = useState<string>('');
  const [formAudioUrl, setFormAudioUrl] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [submittingForm, setSubmittingForm] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [cfg, trackList] = await Promise.all([fetchMusicConfig(), fetchMusicTracks()]);
      setIsActive(cfg.is_active);
      setTracks(trackList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to load music configuration: ' + msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleMasterSwitch = async () => {
    setSavingConfig(true);
    setFeedback(null);
    try {
      const updated = await updateMusicConfig(!isActive);
      setIsActive(updated.is_active);
      setFeedback({
        type: 'success',
        message: updated.is_active
          ? 'Storefront ambient music is now globally ACTIVE.'
          : 'Storefront ambient music has been globally MUTED & DEACTIVATED.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to update master switch: ' + msg });
    } finally {
      setSavingConfig(false);
    }
  };

  const handlePlayPreview = (track: MusicTrack) => {
    const streamUrl = track.served_audio_url || track.audio_file || track.audio_url;
    if (!streamUrl) {
      setFeedback({ type: 'error', message: 'This track does not have a playable audio stream.' });
      return;
    }

    if (previewTrackId === track.id && isPlayingPreview) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingPreview(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(streamUrl);
    audioRef.current = audio;
    setPreviewTrackId(track.id);
    setIsPlayingPreview(true);

    audio.play().catch((e) => {
      setFeedback({ type: 'error', message: 'Browser audio playback error: ' + e.message });
      setIsPlayingPreview(false);
    });

    audio.onended = () => {
      setIsPlayingPreview(false);
      setPreviewTrackId(null);
    };
  };

  const handleOpenAddModal = () => {
    setEditingTrack(null);
    setFormTitle('');
    setFormAudioFileUrl('');
    setFormAudioUrl('');
    setFormIsActive(true);
    setFormSortOrder(tracks.length + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (track: MusicTrack) => {
    setEditingTrack(track);
    setFormTitle(track.title);
    setFormAudioFileUrl(track.audio_file || '');
    setFormAudioUrl(track.audio_url || '');
    setFormIsActive(track.is_active);
    setFormSortOrder(track.sort_order);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File exceeds 10MB limit. Please upload an MP3 or OGG under 10MB.');
      return;
    }

    setUploadingFile(true);
    try {
      const result = await uploadTrackAudio(file);
      setFormAudioFileUrl(result.url);
      if (!formTitle) {
        // Suggest title from filename
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setFormTitle(cleanName);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Upload failed: ' + msg);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Track title is required.');
      return;
    }
    if (!formAudioFileUrl.trim() && !formAudioUrl.trim()) {
      alert('Please upload an audio file or provide an external audio stream URL.');
      return;
    }

    setSubmittingForm(true);
    try {
      if (editingTrack) {
        await updateMusicTrack(editingTrack.id, {
          title: formTitle.trim(),
          audio_file: formAudioFileUrl.trim() || null,
          audio_url: formAudioUrl.trim() || null,
          is_active: formIsActive,
          sort_order: formSortOrder,
        });
        setFeedback({ type: 'success', message: `Track "${formTitle}" updated successfully.` });
      } else {
        await createMusicTrack({
          title: formTitle.trim(),
          audio_file: formAudioFileUrl.trim() || null,
          audio_url: formAudioUrl.trim() || null,
          is_active: formIsActive,
          sort_order: formSortOrder,
        });
        setFeedback({ type: 'success', message: `New track "${formTitle}" added to library.` });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Error saving track: ' + msg);
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDelete = async (track: MusicTrack) => {
    if (!confirm(`Are you sure you want to delete "${track.title}"?`)) return;
    try {
      await deleteMusicTrack(track.id);
      setFeedback({ type: 'success', message: `Track "${track.title}" was removed.` });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to delete track: ' + msg });
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tracks.length) return;

    const reordered = [...tracks];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    setTracks(reordered);
    try {
      await reorderMusicTracks(reordered.map((t) => t.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: 'Failed to reorder: ' + msg });
      loadData();
    }
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1',
              }}
            >
              <Headphones size={22} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Storefront Music & Ambient Soundscape
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            Curate brand soundtracks, upload MP3/OGG audio files, and control floating audio player on {currentStore.name}.
          </p>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
            }}
          >
            <Plus size={16} />
            <span>Add Track</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Master Switch Workstation Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#ffffff',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: isActive ? '#4ade80' : '#f87171',
                border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <Radio size={12} className={isActive ? 'animate-pulse' : ''} />
              {isActive ? 'Storefront Live & Active' : 'Storefront Muted / Inactive'}
            </span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>
            Ambient Storefront Master Switch
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
            Activate or instantly mute the floating ambient music player for all storefront shoppers across all drops.
            When active, the player defers its 7s initialization to safeguard Core Web Vitals (LCP/FID).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Current Master State</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: isActive ? '#4ade80' : '#f87171' }}>
              {isActive ? 'ENABLED (ON)' : 'DISABLED (OFF)'}
            </div>
          </div>
          <button
            onClick={handleToggleMasterSwitch}
            disabled={savingConfig}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              cursor: savingConfig ? 'not-allowed' : 'pointer',
              backgroundColor: isActive ? '#ef4444' : '#22c55e',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            <Power size={18} />
            <span>{savingConfig ? 'Updating...' : isActive ? 'Deactivate Player' : 'Activate Player'}</span>
          </button>
        </div>
      </div>

      {/* Track Library Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Music size={18} style={{ color: '#64748b' }} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Audio Track Library ({tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'})
            </h3>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Tracks are served in sequential priority on customer storefronts
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading soundtrack library...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#94a3b8',
              }}
            >
              <Music size={28} />
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#334155' }}>
              No audio tracks added yet
            </h4>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Upload your brand's runway loops or lo-fi beats (MP3 or OGG format) or provide external streaming links.
            </p>
            <button
              onClick={handleOpenAddModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              <span>Add First Track</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', width: '60px' }}>Order</th>
                  <th style={{ padding: '12px 16px' }}>Track Title</th>
                  <th style={{ padding: '12px 16px', width: '110px' }}>Duration</th>
                  <th style={{ padding: '12px 16px', width: '160px' }}>Storage Backend</th>
                  <th style={{ padding: '12px 16px', width: '100px' }}>Status</th>
                  <th style={{ padding: '12px 16px', width: '180px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, idx) => {
                  const isCurrentPreview = previewTrackId === track.id && isPlayingPreview;
                  const isInternal = Boolean(track.audio_file);

                  return (
                    <tr
                      key={track.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isCurrentPreview ? 'rgba(99, 102, 241, 0.04)' : '#ffffff',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Sort priority & arrows */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#64748b', minWidth: '16px' }}>{idx + 1}</span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <button
                              onClick={() => handleMoveOrder(idx, 'up')}
                              disabled={idx === 0}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: '1px',
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                color: idx === 0 ? '#cbd5e1' : '#64748b',
                              }}
                              title="Move Up"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              onClick={() => handleMoveOrder(idx, 'down')}
                              disabled={idx === tracks.length - 1}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: '1px',
                                cursor: idx === tracks.length - 1 ? 'not-allowed' : 'pointer',
                                color: idx === tracks.length - 1 ? '#cbd5e1' : '#64748b',
                              }}
                              title="Move Down"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Title & Preview Button */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            onClick={() => handlePlayPreview(track)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isCurrentPreview ? '#6366f1' : '#f1f5f9',
                              color: isCurrentPreview ? '#ffffff' : '#334155',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                            title={isCurrentPreview ? 'Pause Preview' : 'Play Preview'}
                          >
                            {isCurrentPreview ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
                          </button>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{track.title}</div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                maxWidth: '320px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {track.served_audio_url || 'No stream link'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '12px 16px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        {formatSeconds(track.duration_seconds)}
                      </td>

                      {/* Storage Source */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: isInternal ? '#e0e7ff' : '#f3e8ff',
                            color: isInternal ? '#3730a3' : '#6b21a8',
                          }}
                        >
                          {isInternal ? <Volume2 size={11} /> : <Globe size={11} />}
                          {isInternal ? 'Internal Storage' : 'External Stream'}
                        </span>
                      </td>

                      {/* Active Status Badge */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: track.is_active ? '#dcfce7' : '#f1f5f9',
                            color: track.is_active ? '#166534' : '#64748b',
                          }}
                        >
                          {track.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      {/* Action dock */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handlePlayPreview(track)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isCurrentPreview ? <Pause size={12} /> : <Play size={12} />}
                            <span>{isCurrentPreview ? 'Pause' : 'Play'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(track)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                            title="Edit Track"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={() => handleDelete(track)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                            title="Delete Track"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Track Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Headphones size={18} style={{ color: '#6366f1' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {editingTrack ? 'Edit Music Track' : 'Add Track to Music Library'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTrack} style={{ padding: '24px' }}>
              {/* Track Title */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Track Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Poshplex Street Loop 01"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Upload Audio File (Internal Media) */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Upload Audio File (MP3 / OGG)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="audio/mp3,audio/mpeg,audio/ogg,.mp3,.ogg"
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: uploadingFile ? 'wait' : 'pointer',
                    backgroundColor: formAudioFileUrl ? '#f0fdf4' : '#f8fafc',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UploadCloud size={24} style={{ color: formAudioFileUrl ? '#22c55e' : '#64748b', margin: '0 auto 6px auto' }} />
                  {uploadingFile ? (
                    <div style={{ fontSize: '13px', color: '#64748b' }}>Uploading audio to server storage...</div>
                  ) : formAudioFileUrl ? (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                        File Uploaded Successfully
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', marginTop: '4px' }}>
                        {formAudioFileUrl}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        Click to select MP3 or OGG file
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Max file size: 10MB. Stored securely on server media.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* External Stream URL (Fallback) */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Or External Audio Stream URL (Optional Fallback)
                </label>
                <input
                  type="url"
                  value={formAudioUrl}
                  onChange={(e) => setFormAudioUrl(e.target.value)}
                  placeholder="https://cdn.example.com/audio/track1.mp3"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Internal uploaded file always takes priority over external URL stream.
                </div>
              </div>

              {/* Sort Order and Active State */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Sort Order (Priority)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Active on Storefront
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '38px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>{formIsActive ? 'Active in playlist' : 'Muted / Inactive'}</span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm || uploadingFile}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submittingForm || uploadingFile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submittingForm ? 'Saving...' : editingTrack ? 'Update Track' : 'Save Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
