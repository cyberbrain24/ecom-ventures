import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName: string;
  itemType?: string;
  warningMessage?: string;
  confirmButtonText?: string;
  /** Label shown on the confirm button while the action is running. */
  busyButtonText?: string;
  isDeleting?: boolean;
  /** Server error from the last attempt, shown inside the modal so the admin can retry or cancel. */
  errorMessage?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Branded confirmation dialog for destructive or status-changing actions. It names the target,
 * states the consequence, and shows any error inline without closing.
 *
 * @param props - Visibility, target description, copy, busy flag, error text and handlers
 * @returns The confirmation modal, or null when closed
 */
export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Confirm Resource Deletion',
  itemName,
  itemType = 'Record',
  warningMessage = 'Are you sure you want to permanently delete this resource? This operation is irreversible and all linked tenant mappings will be affected.',
  confirmButtonText = 'Confirm & Delete',
  busyButtonText = 'Deleting...',
  isDeleting = false,
  errorMessage = null,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-rose-800">
            <div className="h-7 w-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            {warningMessage}
          </p>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Target {itemType}:
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[220px]">
              {itemName}
            </span>
          </div>

          {errorMessage && (
            <div role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2 rounded whitespace-pre-line">
              {errorMessage}
            </div>
          )}

          <div className="text-[10.5px] text-rose-600 font-medium bg-rose-50/60 p-2 rounded border border-rose-100 flex items-start space-x-1.5">
            <span className="font-bold">•</span>
            <span>Approval required: Please review carefully before confirming.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isDeleting ? busyButtonText : confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
