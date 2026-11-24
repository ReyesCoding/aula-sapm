import { CheckCircle2, XCircle } from 'lucide-react';

interface InfoDialogProps {
  isOpen: boolean;
  variant: 'success' | 'error';
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * Popup simple de resultado (éxito/error) con el mismo lenguaje visual que
 * ConfirmDialog.tsx, para reemplazar mensajes de resultado que antes se
 * mostraban como texto inline suelto (fácil de perder de vista) o, peor,
 * como un `alert()` nativo.
 */
export const InfoDialog = ({ isOpen, variant, title, message, onClose }: InfoDialogProps) => {
  if (!isOpen) return null;

  const Icon = variant === 'success' ? CheckCircle2 : XCircle;
  const iconClasses = variant === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600';
  const buttonClasses = variant === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

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
          </div>
          <button
            onClick={onClose}
            className={`w-full py-2 rounded-lg text-white font-bold transition shadow ${buttonClasses}`}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
