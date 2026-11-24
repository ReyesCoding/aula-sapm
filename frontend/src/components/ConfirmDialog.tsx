import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = icono/botón rojo (acción destructiva). false = icono/botón neutral (confirmación informativa). */
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmación reutilizable con el mismo lenguaje visual del
 * resto de la app (ver el que ya existía en TaskManagementModal.tsx, que
 * sirvió de referencia). Reemplaza los `window.confirm()` nativos
 * esparcidos por el frontend (UsersManagement, TeachersManagement,
 * DocumentsPanel, EventModal, GradesPanel, ThreadDetailModal, TakeExamModal,
 * AcademicDashboard) — un `confirm()` del navegador no se puede estilizar,
 * se ve genérico/poco profesional, y no puede mostrar un estado de carga o
 * un error de la API como este sí puede.
 */
export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Sí, continuar',
  cancelLabel = 'Cancelar',
  danger = true,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const Icon = danger ? AlertTriangle : HelpCircle;
  const iconClasses = danger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600';
  const confirmClasses = danger
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-primary hover:bg-blue-800';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`p-3 rounded-full ${iconClasses}`}>
            <Icon size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
            {error && (
              <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
            )}
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 py-2 rounded-lg text-white font-bold transition shadow flex justify-center items-center gap-2 disabled:opacity-70 ${confirmClasses}`}
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
