import { AlertTriangle, Info, X } from 'lucide-react';

type DialogVariant = 'confirm' | 'error' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  variant = 'confirm',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isAlert = variant !== 'confirm';

  const iconColors: Record<DialogVariant, string> = {
    confirm: 'text-amber-500 bg-amber-50',
    error:   'text-red-500 bg-red-50',
    info:    'text-primary-600 bg-primary-50',
  };

  const confirmColors: Record<DialogVariant, string> = {
    confirm: 'bg-amber-500 hover:bg-amber-600 text-white',
    error:   'bg-red-600 hover:bg-red-700 text-white',
    info:    'bg-primary-600 hover:bg-primary-700 text-white',
  };

  const Icon = variant === 'error' ? AlertTriangle : Info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={isAlert ? onClose : undefined}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`flex-shrink-0 rounded-full p-2 ${iconColors[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 pb-6">
          {!isAlert && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={isAlert ? onClose : onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${confirmColors[variant]}`}
          >
            {isAlert ? 'OK' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
