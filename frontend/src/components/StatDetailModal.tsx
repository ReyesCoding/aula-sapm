import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Popup genérico para "ver más información" al hacer clic en una tarjeta
 * de estadísticas (StatsGrid con onStatClick). Extraído del modal que
 * AcademicDashboard.tsx ya tenía escrito inline, para que Admin/Centro
 * puedan reusarlo en vez de duplicar el mismo marcado.
 */
export const StatDetailModal = ({ isOpen, title, onClose, children }: Props) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">{children}</div>
        <div className="p-3 bg-gray-50 text-center">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
