import React from 'react';
import { Palette, CheckCircle, Layers, Pencil, Trash2, Gem } from 'lucide-react';
import { ThemeItem } from '../../types/theme';

interface ThemeCardProps {
  theme: ThemeItem;
  onAssignClick: (theme: ThemeItem) => void;
  onEditClick?: (theme: ThemeItem) => void;
  onDeleteClick?: (theme: ThemeItem) => void;
}

/** Returns gradient + accent classes and accent dots for a theme based on its slug */
function getThemeVisual(theme: ThemeItem): {
  gradientClass: string;
  accentClass: string;
  badgeClass: string;
  colorDots: string[];
  Icon: React.FC<{ className?: string }>;
} {
  const slug = theme.slug ?? '';
  const cfg = (theme.config_schema as Record<string, Record<string, string>> | null) ?? {};
  const colors = cfg?.default_colors ?? {};

  if (slug.includes('jewelry')) {
    return {
      gradientClass: 'bg-gradient-to-br from-[#2C1810] via-[#5C3D1E] to-[#8B6914]',
      accentClass: 'text-[#F5D78E]',
      badgeClass: 'bg-[#B8975A]/20 text-[#F5D78E] border-[#B8975A]/40',
      colorDots: [
        colors.primary ?? '#B8975A',
        colors.secondary ?? '#7A5C2E',
        colors.accent ?? '#F5ECD7',
        colors.background ?? '#FDFAF5',
      ],
      Icon: Gem,
    };
  }
  if (slug.includes('artisan')) {
    return {
      gradientClass: 'bg-gradient-to-br from-amber-900 to-amber-700',
      accentClass: 'text-amber-300',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      colorDots: ['#92400E', '#D97706', '#FEF3C7', '#FFFBEB'],
      Icon: Palette,
    };
  }
  if (slug.includes('urban') || slug.includes('streetwear')) {
    return {
      gradientClass: 'bg-gradient-to-br from-zinc-900 to-zinc-700',
      accentClass: 'text-violet-300',
      badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
      colorDots: ['#7C3AED', '#EC4899', '#1A1A2E', '#F8F8F8'],
      Icon: Palette,
    };
  }
  // Default / modern-minimal
  return {
    gradientClass: 'bg-gradient-to-br from-slate-800 to-slate-950',
    accentClass: 'text-teal-300',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    colorDots: ['#0F766E', '#0284C7', '#F8FAFC', '#1E293B'],
    Icon: Palette,
  };
}

export const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  onAssignClick,
  onEditClick,
  onDeleteClick,
}) => {
  const { gradientClass, accentClass, badgeClass, colorDots, Icon } = getThemeVisual(theme);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        {/* Theme Visual Preview Banner */}
        <div className={`h-32 ${gradientClass} p-3.5 flex flex-col justify-between relative overflow-hidden`}>
          <div className="flex justify-between items-start z-10">
            <span className={`text-[11px] font-mono uppercase tracking-wider ${badgeClass} px-2 py-0.5 rounded border`}>
              v{theme.version}
            </span>
            {theme.is_active && (
              <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center space-x-1">
                <CheckCircle className="h-3 w-3 mr-0.5" />
                Active
              </span>
            )}
          </div>

          <div className="z-10">
            <div className="flex items-center space-x-1.5 mb-1">
              <Icon className={`h-4 w-4 ${accentClass}`} />
              <h3 className="text-base font-bold text-white tracking-tight leading-tight">{theme.name}</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">slug: {theme.slug}</span>

            {/* Color Palette Dots */}
            <div className="flex items-center space-x-1.5 mt-2">
              {colorDots.map((color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border-2 border-white/20 shadow-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <span className="text-[10px] text-white/40 ml-1">color palette</span>
            </div>
          </div>

          {/* Decorative Background Graphics */}
          <div className={`absolute -right-6 -bottom-6 w-24 h-24 opacity-20 rounded-full blur-xl`}
            style={{ backgroundColor: colorDots[0] }} />
          <div className={`absolute -left-4 -top-4 w-16 h-16 opacity-10 rounded-full blur-lg`}
            style={{ backgroundColor: colorDots[1] }} />
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-2">
          <p className="text-xs text-slate-600 leading-normal line-clamp-2 min-h-[32px]">
            {theme.description || 'Modern reusable presentation theme blueprint for retail brands.'}
          </p>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1.5">
              <Layers className="h-4 w-4 text-slate-400" />
              <span>Adoption:</span>
            </div>
            <span className="font-semibold text-slate-800">
              {theme.active_stores_count} {theme.active_stores_count === 1 ? 'Store' : 'Stores'}
            </span>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center space-x-2">
        <button
          onClick={() => onAssignClick(theme)}
          className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-sm transition flex items-center justify-center space-x-1.5"
        >
          <Palette className="h-3.5 w-3.5 text-teal-400" />
          <span>Assign Theme</span>
        </button>
        {onEditClick && (
          <button
            onClick={() => onEditClick(theme)}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-md transition"
            title="Edit Theme"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDeleteClick && (
          <button
            onClick={() => onDeleteClick(theme)}
            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-md transition"
            title="Delete Theme"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
