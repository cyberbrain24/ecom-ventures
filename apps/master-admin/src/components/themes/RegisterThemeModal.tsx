import React, { useState } from 'react';
import { X, Palette } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

interface RegisterThemeModalProps {
  onClose: () => void;
  onRegistered: () => void;
}

export const RegisterThemeModal: React.FC<RegisterThemeModalProps> = ({ onClose, onRegistered }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await api.post('/platform/themes', {
        name,
        slug: slug.toLowerCase().trim(),
        description,
        version,
        preview_image_url: previewImageUrl.trim() || undefined,
        config_schema: {
          supported_layouts: ['grid', 'list', 'carousel'],
          allow_custom_fonts: true,
        },
      });
      onRegistered();
      onClose();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Failed to register theme blueprint.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-teal-400" />
            <h3 className="text-base font-bold">Register Theme Blueprint</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Theme Name</label>
            <input
              type="text"
              required
              aria-label="Theme Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
              }}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Display name shown in the theme registry</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Slug Identifier</label>
            <input
              type="text"
              required
              aria-label="Slug Identifier"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Lowercase letters, digits and hyphens</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Version</label>
            <input
              type="text"
              required
              aria-label="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Preview Image URL (Optional)</label>
            <input
              type="url"
              value={previewImageUrl}
              onChange={(e) => setPreviewImageUrl(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="https://images.unsplash.com/..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Description</label>
            <textarea
              rows={2}
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Layout details and ideal retail categories</span>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Theme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
