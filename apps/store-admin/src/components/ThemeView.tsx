import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Type,
  Save,
  Check,
  RefreshCw,
  Sliders,
  Eye,
  Layers,
  Wand2,
  Maximize2,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';
import {
  ThemeCustomizerConfig,
  ThemePaletteColors,
  ThemeTypographyConfig,
  StoreBrand,
} from '../types/store';
import { fetchCurrentThemeConfig, updateThemeTokens } from '../lib/theme-api';

interface ThemeViewProps {
  currentStore: StoreBrand;
  themeConfig?: ThemeCustomizerConfig | null;
}

interface PalettePreset {
  name: string;
  description: string;
  colors: ThemePaletteColors;
}

const PALETTE_PRESETS: PalettePreset[] = [
  {
    name: 'Minimal Mono',
    description: 'Clean high-contrast monochrome aesthetic for modern urban and apparel drops.',
    colors: {
      primary: '#0f172a',
      secondary: '#475569',
      accent: '#000000',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      muted: '#64748b',
    },
  },
  {
    name: 'Midnight Luxury Gold',
    description: 'Deep obsidian and gleaming royal gold for luxury jewelry, watches and couture.',
    colors: {
      primary: '#d4af37',
      secondary: '#c59b27',
      accent: '#f59e0b',
      background: '#090d16',
      surface: '#131b2e',
      text: '#f8fafc',
      muted: '#94a3b8',
    },
  },
  {
    name: 'Cyber Neo Emerald',
    description: 'Electrifying neon emerald accents on deep obsidian for streetwear and high-tech.',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#06b6d4',
      background: '#090d16',
      surface: '#111827',
      text: '#f9fafb',
      muted: '#9ca3af',
    },
  },
  {
    name: 'Blush Rose & Ivory',
    description: 'Soft delicate blush, ivory and crimson accents for feminine fashion and innerwear.',
    colors: {
      primary: '#e11d48',
      secondary: '#be123c',
      accent: '#fb7185',
      background: '#fffbfb',
      surface: '#fff1f2',
      text: '#4c0519',
      muted: '#9f1239',
    },
  },
  {
    name: 'Royal Heritage Emerald',
    description: 'Rich royal emerald and cream for traditional couture, sarees and ethnic wear.',
    colors: {
      primary: '#065f46',
      secondary: '#047857',
      accent: '#d97706',
      background: '#fcfdfd',
      surface: '#f0fdf4',
      text: '#064e3b',
      muted: '#047857',
    },
  },
  {
    name: 'Neo Lavender & Violet',
    description: 'Vibrant digital purple and soothing violet for contemporary lifestyle and beauty.',
    colors: {
      primary: '#7c3aed',
      secondary: '#6d28d9',
      accent: '#a855f7',
      background: '#faf5ff',
      surface: '#f3e8ff',
      text: '#3b0764',
      muted: '#6b21a8',
    },
  },
  {
    name: 'Terracotta & Sand',
    description: 'Warm artisan earthy tones with sun-baked terracotta for crafts and natural goods.',
    colors: {
      primary: '#c2410c',
      secondary: '#ea580c',
      accent: '#d97706',
      background: '#fffdfa',
      surface: '#fff7ed',
      text: '#7c2d12',
      muted: '#9a3412',
    },
  },
  {
    name: 'Deep Oceanic Cyan',
    description: 'Sharp tech electric cyan on deep oceanic navy for modern electronics and gadgets.',
    colors: {
      primary: '#06b6d4',
      secondary: '#0284c7',
      accent: '#38bdf8',
      background: '#030712',
      surface: '#0f172a',
      text: '#f0f9ff',
      muted: '#64748b',
    },
  },
];

interface FontPairingPreset {
  name: string;
  category: string;
  heading: string;
  body: string;
  headingWeight: '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing: 'tight' | 'normal' | 'wide' | 'expanded';
  textTransform: 'none' | 'uppercase' | 'capitalize';
}

const FONT_PAIRING_PRESETS: FontPairingPreset[] = [
  {
    name: 'Modern Minimalist',
    category: 'Clean Sans',
    heading: 'Inter',
    body: 'Inter',
    headingWeight: '700',
    letterSpacing: 'tight',
    textTransform: 'none',
  },
  {
    name: 'Contemporary Luxury',
    category: 'Editorial Luxury',
    heading: 'Playfair Display',
    body: 'Montserrat',
    headingWeight: '700',
    letterSpacing: 'wide',
    textTransform: 'none',
  },
  {
    name: 'Neo-Streetwear Display',
    category: 'Urban Grotesk',
    heading: 'Space Grotesk',
    body: 'DM Sans',
    headingWeight: '800',
    letterSpacing: 'tight',
    textTransform: 'uppercase',
  },
  {
    name: 'Editorial High-Fashion',
    category: 'Vogue Serif',
    heading: 'Cormorant Garamond',
    body: 'Plus Jakarta Sans',
    headingWeight: '600',
    letterSpacing: 'wide',
    textTransform: 'none',
  },
  {
    name: 'Future Tech & Matrix',
    category: 'Modern Tech',
    heading: 'Outfit',
    body: 'Roboto',
    headingWeight: '700',
    letterSpacing: 'normal',
    textTransform: 'none',
  },
  {
    name: 'Royal Heritage & Gold',
    category: 'Classical Roman',
    heading: 'Cinzel',
    body: 'Lato',
    headingWeight: '700',
    letterSpacing: 'expanded',
    textTransform: 'uppercase',
  },
  {
    name: 'Bold Street Impact',
    category: 'Condensed Punch',
    heading: 'Bebas Neue',
    body: 'Open Sans',
    headingWeight: '400',
    letterSpacing: 'wide',
    textTransform: 'uppercase',
  },
  {
    name: 'Bengali Ethnic Couture',
    category: 'Bilingual Heritage',
    heading: 'Hind Siliguri',
    body: 'Noto Sans Bengali',
    headingWeight: '700',
    letterSpacing: 'normal',
    textTransform: 'none',
  },
];

const HEADING_FONT_CATEGORIES = [
  {
    category: 'Modern Grotesk & Sans-Serif',
    fonts: ['Inter', 'Plus Jakarta Sans', 'Outfit', 'Montserrat', 'Space Grotesk', 'Syne', 'Poppins', 'DM Sans', 'Raleway'],
  },
  {
    category: 'High-Fashion & Luxury Serif',
    fonts: ['Playfair Display', 'Cinzel', 'Cormorant Garamond', 'Merriweather', 'Lora'],
  },
  {
    category: 'Bold Display & Urban Impact',
    fonts: ['Bebas Neue', 'Oswald'],
  },
  {
    category: 'Bengali & South-Asian Heritage',
    fonts: ['Hind Siliguri', 'Noto Sans Bengali'],
  },
];

const BODY_FONTS = [
  'Inter',
  'Plus Jakarta Sans',
  'Roboto',
  'DM Sans',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Nunito Sans',
  'Work Sans',
  'Hind Siliguri',
  'Noto Sans Bengali',
];

export const ThemeView: React.FC<ThemeViewProps> = ({ currentStore }) => {
  const [themeConfig, setThemeConfig] = useState<ThemeCustomizerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'colors' | 'typography' | 'layout' | 'preview'>('colors');

  // Advanced Color Palette Tokens
  const [colors, setColors] = useState<ThemePaletteColors>({
    primary: '#0f172a',
    secondary: '#3b82f6',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
  });

  // Advanced Typography Tokens
  const [typography, setTypography] = useState<ThemeTypographyConfig>({
    heading: 'Inter',
    body: 'Inter',
    headingWeight: '700',
    letterSpacing: 'normal',
    textTransform: 'none',
    fontSizeScale: 'standard',
  });

  // Layout & Announcement Tokens
  const [borderRadius, setBorderRadius] = useState<'none' | 'sm' | 'md' | 'lg' | 'full'>('sm');
  const [density, setDensity] = useState<'compact' | 'airy'>('compact');
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState('Free shipping on all prepaid orders nationwide!');

  const loadTheme = async () => {
    setIsLoading(true);
    try {
      const cfg = await fetchCurrentThemeConfig();
      if (cfg) {
        setThemeConfig(cfg);
        setColors(cfg.colors);
        setTypography(cfg.typography);
        setBorderRadius(cfg.borderRadius || 'sm');
        setShowAnnouncement(cfg.showAnnouncement);
        setAnnouncementText(cfg.announcementText || '');
      }
    } catch {
      // Fallback defaults apply
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTheme();
  }, [currentStore.slug]);

  const handleApplyPalettePreset = (preset: PalettePreset) => {
    setColors({ ...preset.colors });
    setNotice({ type: 'success', text: `Applied palette preset "${preset.name}". Click "Save Appearance" to publish.` });
  };

  const handleApplyFontPreset = (preset: FontPairingPreset) => {
    setTypography((prev) => ({
      ...prev,
      heading: preset.heading,
      body: preset.body,
      headingWeight: preset.headingWeight,
      letterSpacing: preset.letterSpacing,
      textTransform: preset.textTransform,
    }));
    setNotice({ type: 'success', text: `Applied typography pairing "${preset.name}". Click "Save Appearance" to publish.` });
  };

  const handleColorChange = (field: keyof ThemePaletteColors, value: string) => {
    setColors((prev) => ({ ...prev, [field]: value }));
  };

  const handleTypographyChange = (field: keyof ThemeTypographyConfig, value: string) => {
    setTypography((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      await updateThemeTokens({
        colors,
        typography,
        borderRadius,
        density,
        showAnnouncement,
        announcementText,
      });

      setThemeConfig({
        themeName: themeConfig?.themeName || `${currentStore.name} Theme`,
        themeSlug: themeConfig?.themeSlug || 'fashion',
        primaryColor: colors.primary,
        secondaryColor: colors.secondary,
        headingFont: typography.heading,
        bodyFont: typography.body,
        borderRadius,
        headerLayout: 'standard',
        showAnnouncement,
        announcementText,
        colors,
        typography,
      });

      setIsEditing(false);
      setNotice({ type: 'success', text: 'Store theme appearance, color palette & typography updated successfully!' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to update store theme appearance.' });
    } finally {
      setIsSaving(false);
    }
  };

  const activeTheme: ThemeCustomizerConfig = themeConfig || {
    themeName: `${currentStore.name} Theme`,
    themeSlug: 'fashion',
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    headingFont: typography.heading,
    bodyFont: typography.body,
    borderRadius: 'sm',
    headerLayout: 'standard',
    showAnnouncement: false,
    announcementText: '',
    colors,
    typography,
  };

  const letterSpacingValue =
    typography.letterSpacing === 'tight'
      ? '-0.03em'
      : typography.letterSpacing === 'wide'
      ? '0.06em'
      : typography.letterSpacing === 'expanded'
      ? '0.12em'
      : '0em';

  const radiusValue =
    borderRadius === 'none'
      ? '0px'
      : borderRadius === 'sm'
      ? '4px'
      : borderRadius === 'md'
      ? '8px'
      : borderRadius === 'lg'
      ? '16px'
      : '9999px';

  if (isLoading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ height: '32px', width: '320px', background: 'var(--border)', borderRadius: '6px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div style={{ height: '300px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }} />
          <div style={{ height: '300px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header bar */}
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              Theme Appearance & Customization
            </h1>
            <span className="badge badge-active">{activeTheme.themeName.toUpperCase()}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Configure independent store color palette, advance typography pairing, radius and live storefront tokens for <code>{currentStore.name}</code>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`btn btn-sm ${isEditing ? 'btn-secondary' : 'btn-primary'}`}
            style={{ gap: '6px' }}
          >
            <Palette size={14} />
            <span>{isEditing ? 'Exit Customizer' : 'Customize Appearance'}</span>
          </button>
          {isEditing && (
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="btn btn-sm btn-primary"
              style={{ gap: '6px', backgroundColor: '#059669', borderColor: '#059669' }}
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Appearance'}</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`}
          style={{ marginBottom: '16px' }}
        >
          {notice.text}
        </div>
      )}

      {/* Ribbon Color Preview Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          marginBottom: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ flex: 1, height: '36px', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.text, opacity: 0.8 }}>Canvas</span>
        </div>
        <div style={{ flex: 1, height: '36px', background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.text, opacity: 0.8 }}>Surface</span>
        </div>
        <div style={{ flex: 1.5, height: '36px', background: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>Primary ({colors.primary})</span>
        </div>
        <div style={{ flex: 1.5, height: '36px', background: colors.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>Secondary ({colors.secondary})</span>
        </div>
        <div style={{ flex: 1.2, height: '36px', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>Accent</span>
        </div>
        <div style={{ flex: 1, height: '36px', background: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.background }}>Text</span>
        </div>
        <div style={{ flex: 1, height: '36px', background: colors.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff' }}>Muted</span>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('colors')}
          className={`btn btn-sm ${activeTab === 'colors' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Palette size={14} />
          <span>🎨 Advance Color Palette</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('typography')}
          className={`btn btn-sm ${activeTab === 'typography' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Type size={14} />
          <span>🔤 Advance Typography Pairing</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('layout')}
          className={`btn btn-sm ${activeTab === 'layout' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Sliders size={14} />
          <span>📐 Radius & Announcement</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ gap: '6px' }}
        >
          <Eye size={14} />
          <span>👁️ Storefront Live Simulator</span>
        </button>
      </div>

      {/* TAB 1: ADVANCE COLOR PALETTE */}
      {activeTab === 'colors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Curated Presets Bar */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wand2 size={16} />
                <span>Curated Professional Color Presets</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1-Click aesthetic palette synchronization</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {PALETTE_PRESETS.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => handleApplyPalettePreset(preset)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: '#fff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
                    <div style={{ flex: 1, background: preset.colors.background }} />
                    <div style={{ flex: 1, background: preset.colors.surface }} />
                    <div style={{ flex: 1.5, background: preset.colors.primary }} />
                    <div style={{ flex: 1, background: preset.colors.secondary }} />
                    <div style={{ flex: 1, background: preset.colors.accent }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '3px' }}>
                    {preset.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {preset.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Granular Color Tokens Form */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={16} />
                <span>Granular Store Color Tokens</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fine-tune hex codes for all store elements</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Primary Color */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Primary Brand Accent *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Used for main action buttons, active navigation markers, and header highlights.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Secondary Accent *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Used for secondary action pills, subtle icons, border trims, and badges.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Accent / Sale Color */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Flash / Sale Accent Color *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Applied to discount badges, urgency chips, and special offer banners.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Body Canvas Background */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Storefront Canvas Background *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Base background color of the storefront page body.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Surface / Card Background */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Surface & Card Background *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Background for product cards, cart drawer, modals and dropdown menus.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.surface}
                    onChange={(e) => handleColorChange('surface', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.surface}
                    onChange={(e) => handleColorChange('surface', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Text Primary */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Primary Heading & Text Color *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  High contrast text color for product titles, prices, and main headings.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Text Muted */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Muted & Secondary Text Color *</label>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Subtle color for descriptions, variant specs, SKUs and breadcrumbs.
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={colors.muted}
                    onChange={(e) => handleColorChange('muted', e.target.value)}
                    style={{ width: '44px', height: '38px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    value={colors.muted}
                    onChange={(e) => handleColorChange('muted', e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADVANCE TYPOGRAPHY PAIRING */}
      {activeTab === 'typography' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Curated Font Pairings */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wand2 size={16} />
                <span>Curated Font Pairing Presets</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Designer-tested heading + body combinations</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {FONT_PAIRING_PRESETS.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => handleApplyFontPreset(preset)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: '#fff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span className="badge badge-outline" style={{ fontSize: '0.65rem', marginBottom: '6px' }}>
                    {preset.category}
                  </span>
                  <div style={{ fontFamily: preset.heading, fontWeight: preset.headingWeight as any, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {preset.heading}
                  </div>
                  <div style={{ fontFamily: preset.body, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Body: {preset.body}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Granular Typography Controls */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Type size={16} />
                <span>Granular Typography Parameters</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
              {/* Heading Font Family */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Heading Font Family</label>
                <select
                  value={typography.heading}
                  onChange={(e) => handleTypographyChange('heading', e.target.value)}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                >
                  {HEADING_FONT_CATEGORIES.map((cat) => (
                    <optgroup key={cat.category} label={cat.category}>
                      {cat.fonts.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Body Font Family */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Body Font Family</label>
                <select
                  value={typography.body}
                  onChange={(e) => handleTypographyChange('body', e.target.value)}
                  className="form-input"
                  style={{ fontWeight: 600 }}
                >
                  {BODY_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Heading Weight */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Heading Font Weight</label>
                <select
                  value={typography.headingWeight}
                  onChange={(e) => handleTypographyChange('headingWeight', e.target.value)}
                  className="form-input"
                >
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-Bold (600)</option>
                  <option value="700">Bold (700) - Recommended</option>
                  <option value="800">Extra-Bold (800)</option>
                  <option value="900">Black (900)</option>
                </select>
              </div>

              {/* Letter Spacing (Tracking) */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Letter Spacing (Tracking)</label>
                <select
                  value={typography.letterSpacing}
                  onChange={(e) => handleTypographyChange('letterSpacing', e.target.value)}
                  className="form-input"
                >
                  <option value="tight">Tight (-0.03em) — Modern Grotesk</option>
                  <option value="normal">Normal (0em) — Standard</option>
                  <option value="wide">Wide (+0.06em) — Editorial</option>
                  <option value="expanded">Expanded (+0.12em) — Luxury & Roman</option>
                </select>
              </div>

              {/* Heading Text Transform */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Heading Text Transform</label>
                <select
                  value={typography.textTransform}
                  onChange={(e) => handleTypographyChange('textTransform', e.target.value)}
                  className="form-input"
                >
                  <option value="none">Default (As Typed)</option>
                  <option value="uppercase">ALL UPPERCASE (Streetwear / Luxury)</option>
                  <option value="capitalize">Capitalize Each Word</option>
                </select>
              </div>

              {/* Base Font Size Scale */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Catalog Information Density</label>
                <select
                  value={typography.fontSizeScale}
                  onChange={(e) => handleTypographyChange('fontSizeScale', e.target.value)}
                  className="form-input"
                >
                  <option value="compact">Compact (14px base — High catalog density)</option>
                  <option value="standard">Standard (15px base — Balanced e-commerce)</option>
                  <option value="airy">Airy (16px base — Luxury & spacious reading)</option>
                </select>
              </div>
            </div>

            {/* Typography Live Box */}
            <div
              style={{
                marginTop: '16px',
                padding: '20px',
                borderRadius: '8px',
                background: colors.surface,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.muted, marginBottom: '8px' }}>
                Interactive Typography Specimen
              </div>
              <h2
                style={{
                  fontFamily: typography.heading,
                  fontWeight: Number(typography.headingWeight),
                  letterSpacing: letterSpacingValue,
                  textTransform: typography.textTransform,
                  fontSize: '1.6rem',
                  color: colors.text,
                  margin: '0 0 8px 0',
                }}
              >
                {currentStore.name} — Contemporary Authentic Drops
              </h2>
              <p
                style={{
                  fontFamily: typography.body,
                  fontSize: typography.fontSizeScale === 'compact' ? '0.85rem' : typography.fontSizeScale === 'airy' ? '1rem' : '0.92rem',
                  color: colors.muted,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Engineered for rapid mobile conversion across Bangladesh. Featuring high-velocity checkout, authenticated multi-tenant backend architecture, and seamless ambient soundscapes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAYOUT & ANNOUNCEMENT */}
      {activeTab === 'layout' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={16} />
                <span>Corner Radius & Visual Density</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Corner Radius Preset</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {(['none', 'sm', 'md', 'lg', 'full'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBorderRadius(r)}
                      className={`btn btn-sm ${borderRadius === r ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        borderRadius: r === 'none' ? '0px' : r === 'sm' ? '4px' : r === 'md' ? '8px' : r === 'lg' ? '14px' : '9999px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    >
                      {r === 'none' ? 'Sharp (0px)' : r === 'sm' ? 'Small (4px)' : r === 'md' ? 'Medium (8px)' : r === 'lg' ? 'Large (16px)' : 'Pill (Full)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Storefront Content Density</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setDensity('compact')}
                    className={`btn btn-sm ${density === 'compact' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Compact (High Catalog Density)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensity('airy')}
                    className={`btn btn-sm ${density === 'airy' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Airy (Spacious Editorial)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={16} />
                <span>Storefront Announcement Bar</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showAnnouncement}
                  onChange={(e) => setShowAnnouncement(e.target.checked)}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Display top ticker announcement banner</span>
              </label>
            </div>

            {showAnnouncement && (
              <div className="form-group">
                <label className="form-label">Announcement Message</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Nationwide Fast Express Delivery across Bangladesh | Cash On Delivery Available"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STOREFRONT LIVE SIMULATOR */}
      {activeTab === 'preview' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {/* Simulated Browser Bar */}
          <div style={{ background: '#0f172a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            </div>
            <div style={{ flex: 1, background: '#1e293b', borderRadius: '4px', padding: '4px 12px', color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
              https://{currentStore.slug}.localhost:5200
            </div>
          </div>

          {/* Simulated Storefront Container */}
          <div style={{ background: colors.background, color: colors.text, minHeight: '480px', padding: '24px' }}>
            {/* Announcement Banner */}
            {showAnnouncement && (
              <div
                style={{
                  background: colors.primary,
                  color: '#ffffff',
                  textAlign: 'center',
                  padding: '8px 12px',
                  borderRadius: radiusValue,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginBottom: '20px',
                }}
              >
                {announcementText || 'Special Offer: Free Nationwide Express Delivery!'}
              </div>
            )}

            {/* Header simulation */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: `1px solid ${colors.muted}33`,
                marginBottom: '28px',
              }}
            >
              <div
                style={{
                  fontFamily: typography.heading,
                  fontWeight: Number(typography.headingWeight),
                  fontSize: '1.4rem',
                  letterSpacing: letterSpacingValue,
                  textTransform: typography.textTransform,
                  color: colors.text,
                }}
              >
                {currentStore.name}
              </div>

              <div style={{ display: 'flex', gap: '20px', fontSize: '0.82rem', fontFamily: typography.body, fontWeight: 600 }}>
                <span style={{ color: colors.text, cursor: 'pointer' }}>New Arrivals</span>
                <span style={{ color: colors.muted, cursor: 'pointer' }}>Collections</span>
                <span style={{ color: colors.muted, cursor: 'pointer' }}>Editorial</span>
                <span style={{ color: colors.muted, cursor: 'pointer' }}>About</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  style={{
                    backgroundColor: colors.primary,
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: radiusValue,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Bag (0)
                </button>
              </div>
            </div>

            {/* Hero Simulation */}
            <div
              style={{
                background: colors.surface,
                borderRadius: radiusValue,
                padding: '36px 28px',
                marginBottom: '32px',
                border: `1px solid ${colors.muted}22`,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                  backgroundColor: colors.accent,
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: radiusValue,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Limited Edition Capsule
              </span>

              <h1
                style={{
                  fontFamily: typography.heading,
                  fontWeight: Number(typography.headingWeight),
                  letterSpacing: letterSpacingValue,
                  textTransform: typography.textTransform,
                  fontSize: '2.1rem',
                  color: colors.text,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Contemporary Aesthetics & Urban Architecture
              </h1>

              <p
                style={{
                  fontFamily: typography.body,
                  color: colors.muted,
                  fontSize: '0.95rem',
                  maxWidth: '560px',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                Explore our curated drops crafted with handpicked fabrics, refined silhouettes, and bespoke attention to modern streetwear culture.
              </p>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  style={{
                    backgroundColor: colors.primary,
                    color: '#ffffff',
                    padding: '10px 22px',
                    borderRadius: radiusValue,
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Shop The Drop
                </button>
                <button
                  type="button"
                  style={{
                    backgroundColor: 'transparent',
                    color: colors.text,
                    border: `1px solid ${colors.secondary}`,
                    padding: '10px 22px',
                    borderRadius: radiusValue,
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  View Lookbook
                </button>
              </div>
            </div>

            {/* Simulated Product Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div
                style={{
                  background: colors.surface,
                  borderRadius: radiusValue,
                  padding: '16px',
                  border: `1px solid ${colors.muted}22`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    height: '160px',
                    background: `${colors.secondary}15`,
                    borderRadius: radiusValue,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: colors.accent,
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: radiusValue,
                    }}
                  >
                    HOT DROP
                  </span>
                  <span style={{ color: colors.muted, fontSize: '0.85rem', fontWeight: 600 }}>Product Specimen Image</span>
                </div>

                <div
                  style={{
                    fontFamily: typography.heading,
                    fontWeight: 700,
                    fontSize: '0.98rem',
                    color: colors.text,
                    letterSpacing: letterSpacingValue,
                  }}
                >
                  Acid Trim Distressed Oversized Tee
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: colors.text, fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
                      ৳ 1,450
                    </span>
                    <span style={{ textDecoration: 'line-through', color: colors.muted, fontSize: '0.8rem' }}>
                      ৳ 1,950
                    </span>
                  </div>
                  <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>
                    IN STOCK
                  </span>
                </div>

                <button
                  type="button"
                  style={{
                    marginTop: '6px',
                    backgroundColor: colors.primary,
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: radiusValue,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Quick Add to Bag
                </button>
              </div>

              <div
                style={{
                  background: colors.surface,
                  borderRadius: radiusValue,
                  padding: '16px',
                  border: `1px solid ${colors.muted}22`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    height: '160px',
                    background: `${colors.secondary}15`,
                    borderRadius: radiusValue,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <span style={{ color: colors.muted, fontSize: '0.85rem', fontWeight: 600 }}>Product Specimen Image</span>
                </div>

                <div
                  style={{
                    fontFamily: typography.heading,
                    fontWeight: 700,
                    fontSize: '0.98rem',
                    color: colors.text,
                    letterSpacing: letterSpacingValue,
                  }}
                >
                  Heavyweight French Terry Cargo Pant
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: colors.text, fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
                      ৳ 2,650
                    </span>
                  </div>
                  <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>
                    IN STOCK
                  </span>
                </div>

                <button
                  type="button"
                  style={{
                    marginTop: '6px',
                    backgroundColor: colors.primary,
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: radiusValue,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Quick Add to Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Save Bar when in Editing Mode */}
      {isEditing && (
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '24px',
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} style={{ color: '#fbbf24' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Unsaved Theme Customizations</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Tokens will be published live to the storefront for <code>{currentStore.name}</code>.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                loadTheme();
              }}
              className="btn btn-sm btn-secondary"
              style={{ color: '#ffffff', borderColor: '#334155', background: '#1e293b' }}
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="btn btn-sm btn-primary"
              style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
            >
              <Save size={14} />
              <span>{isSaving ? 'Publishing Tokens...' : 'Save & Publish Live'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
