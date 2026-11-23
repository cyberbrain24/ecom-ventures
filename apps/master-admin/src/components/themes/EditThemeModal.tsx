import React, { useState } from 'react';
import { X, Save, Palette } from 'lucide-react';
import { ThemeItem } from '../../types/theme';
import { apiErrorMessage } from '../../lib/api';

interface EditThemeModalProps {
  theme: ThemeItem;
  onClose: () => void;
  /** Resolves when the server accepted the change; rejects with a message to show inside the modal. */
  onSave: (updatedTheme: ThemeItem) => Promise<void>;
}

/**
 * EditThemeModal edits a theme blueprint's registry fields. It stays open and shows the
 * server error when the save fails.
 *
 * @param props - Theme to edit, close handler, and async save handler
 * @returns The edit modal
 */
export const EditThemeModal: React.FC<EditThemeModalProps> = ({ theme, onClose, onSave }) => {
  const [name, setName] = useState(theme.name);
  const [version, setVersion] = useState(theme.version);
  const [description, setDescription] = useState(theme.description || '');
  const [previewImageUrl, setPreviewImageUrl] = useState(theme.preview_image_url || '');
  const [isActive, setIsActive] = useState(theme.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    const updated: ThemeItem = {
      ...theme,
      name: name.trim(),
      version: version.trim(),
      description: description.trim(),
      preview_image_url: previewImageUrl.trim() || undefined,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    try {
      await onSave(updated);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save theme changes.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-teal-500 flex items-center justify-center text-white">
              <Palette className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold leading-none">Edit Theme Blueprint</h3>
              <p className="text-[10px] text-teal-400 font-mono mt-0.5">{theme.slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {errorMsg && (
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Theme Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Blueprint Version
            </label>
            <input
              type="text"
              required
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              placeholder="1.0.0"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Preview Image URL (Optional)
            </label>
            <input
              type="url"
              value={previewImageUrl}
              onChange={(e) => setPreviewImageUrl(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
              placeholder="https://images.unsplash.com/..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="Design philosophy and styling description..."
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="theme-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
            />
            <label htmlFor="theme-is-active" className="text-xs text-slate-700 font-medium cursor-pointer">
              Active & Available for Brand Assignment
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Theme Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
