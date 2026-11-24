import React from 'react';
import { Palette, CheckCircle, Layers, Pencil, Power, PowerOff } from 'lucide-react';
import { ThemeItem } from '../../types/theme';
import {
  readThemePreview,
  themeColor,
  variantLabel,
  inferVariantFromSlug,
} from '../../lib/theme-preview';

interface ThemeCardProps {
  theme: ThemeItem;
  onAssignClick: (theme: ThemeItem) => void;
  onEditClick?: (theme: ThemeItem) => void;
  /** Called when the admin activates or deactivates the theme. Themes are never deleted. */
  onToggleActiveClick?: (theme: ThemeItem) => void;
  /** True while a status change for this theme is being saved. */
  isToggling?: boolean;
  /** When set, Edit and the status toggle are disabled and this text is shown as their tooltip. */
  controlsDisabledReason?: string;
}

const THEME_FALLBACK_IMAGES: Record<string, string> = {
  'modern-minimal': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
  'artisan-boutique': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
  'urban-streetwear': 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80',
  'jewelry-shop': 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=600&auto=format&fit=crop&q=80',
  'women-inner': 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop&q=80',
  'gadget-store': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
  'inner-fashion': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
  'traditional-fashion': 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
};

/**
 * ThemeCard presents a theme blueprint in the Master Admin Theme Marketplace.
 * Displays high-definition preview media, live design tokens, active deployment stats,
 * and assignment / administrative controls.
 */
export const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  onAssignClick,
  onEditClick,
  onToggleActiveClick,
  isToggling = false,
  controlsDisabledReason,
}) => {
  const preview = readThemePreview(theme.config_schema);
  const background = themeColor(preview, 'background') ?? '#0f172a';
  const text = themeColor(preview, 'text') ?? '#ffffff';
  const primary = themeColor(preview, 'primary') ?? '#059669';
  const variant = variantLabel(preview.variant) ?? inferVariantFromSlug(theme.slug);
  const storeCount = typeof theme.active_stores_count === 'number' ? theme.active_stores_count : null;
  const previewImage = theme.preview_image_url || THEME_FALLBACK_IMAGES[theme.slug] || null;

  const assignDisabledReason = !theme.is_active
    ? 'This theme is inactive. Activate it before assigning it to a store.'
    : undefined;

  return (
    <div
      className={`group bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between ${
        theme.is_active ? 'border-slate-200/90' : 'border-slate-300 opacity-90'
      }`}
    >
      <div>
        {/* Visual Showcase Header (Cover Image or Curated Mockup) */}
        <div className="relative h-44 overflow-hidden bg-slate-900 flex flex-col justify-between">
          {previewImage ? (
            <>
              <img
                src={previewImage}
                alt={`${theme.name} preview`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/40" />
            </>
          ) : (
            <div
              className="absolute inset-0 flex flex-col justify-between p-3.5"
              style={{ backgroundColor: background, color: text }}
            >
              {/* Mini Browser Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[10px] font-mono opacity-60">storefront/{theme.slug}</span>
              </div>
              <div className="py-2">
                <div className="text-sm font-bold truncate">{theme.name}</div>
                <div className="text-[11px] opacity-75 truncate">{theme.description}</div>
              </div>
            </div>
          )}

          {/* Top Bar Badges */}
          <div className="relative z-10 p-3 flex items-start justify-between gap-2">
            <span className="backdrop-blur-md bg-slate-950/60 text-white border border-white/20 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              {variant}
            </span>
            <span
              className={`backdrop-blur-md text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border ${
                theme.is_active
                  ? 'bg-emerald-500/90 text-white border-emerald-400/30'
                  : 'bg-amber-500/90 text-white border-amber-400/30'
              }`}
            >
              {theme.is_active ? <CheckCircle className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
              {theme.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Bottom Bar: Swatches & Slug Pill */}
          <div className="relative z-10 p-3 flex items-end justify-between gap-2">
            <div className="flex items-center -space-x-1.5 hover:space-x-1 transition-all" aria-label="Color palette">
              {preview.colors.slice(0, 6).map((token) => (
                <span
                  key={token.key}
                  className="w-5 h-5 rounded-full ring-2 ring-white/90 shadow-md flex-shrink-0 cursor-help transform hover:scale-125 transition-transform"
                  style={{ backgroundColor: token.value }}
                  title={`${token.key}: ${token.value}`}
                />
              ))}
            </div>
            <span className="backdrop-blur-md bg-black/50 text-white/90 text-[10.5px] font-mono px-2 py-0.5 rounded border border-white/20">
              {theme.slug}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          {/* Title & Version Header */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-600 transition-colors leading-snug truncate">
                {theme.name}
              </h3>
              <span className="text-[11px] font-mono bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded flex-shrink-0">
                v{theme.version}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 min-h-[34px] mt-1.5">
              {theme.description || 'Modern, responsive ecommerce storefront blueprint optimized for conversion.'}
            </p>
          </div>

          {/* Store Usage Counter */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>Assigned Stores:</span>
            </div>
            <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
              {storeCount === null
                ? '0 Stores'
                : `${storeCount} ${storeCount === 1 ? 'Store' : 'Stores'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAssignClick(theme)}
          disabled={!!assignDisabledReason}
          title={assignDisabledReason ?? 'Assign this theme to a store'}
          className="flex-1 py-2 px-3 bg-slate-900 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:bg-slate-900"
        >
          <Palette className="h-3.5 w-3.5 text-teal-400" />
          <span>Assign Theme</span>
        </button>
        {onEditClick && (
          <button
            type="button"
            onClick={() => onEditClick(theme)}
            disabled={!!controlsDisabledReason || isToggling}
            className="p-2 text-slate-600 hover:text-teal-600 hover:bg-white border border-slate-200/90 rounded-lg transition shadow-sm disabled:opacity-40"
            title={controlsDisabledReason ?? 'Edit Theme Blueprint'}
            aria-label={`Edit ${theme.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onToggleActiveClick && (
          <button
            type="button"
            onClick={() => onToggleActiveClick(theme)}
            disabled={!!controlsDisabledReason || isToggling}
            className={`inline-flex items-center gap-1 px-2.5 py-2 border rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
              theme.is_active
                ? 'text-rose-700 bg-rose-50/60 border-rose-200 hover:bg-rose-100/70'
                : 'text-emerald-700 bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/70'
            }`}
            title={controlsDisabledReason ?? (theme.is_active ? 'Deactivate this theme' : 'Activate this theme')}
            aria-label={`${theme.is_active ? 'Deactivate' : 'Activate'} ${theme.name}`}
          >
            {theme.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            <span>{isToggling ? 'Saving...' : theme.is_active ? 'Deactivate' : 'Activate'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
