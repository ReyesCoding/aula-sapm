import { useState } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { createThread } from '../services/forum.service';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

interface CreateThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: number;
  onSuccess: () => void;
}

export const CreateThreadModal = ({ isOpen, onClose, subjectId, onSuccess }: CreateThreadModalProps) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    setTitle('');
    setBody('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Título y contenido son obligatorios.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await createThread(subjectId, title.trim(), body.trim());
      onSuccess();
      resetAndClose();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al crear el tema.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <h3 className="font-bold text-lg">Nuevo Tema de Foro</h3>
          <button onClick={resetAndClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Dudas sobre la tarea de esta semana"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Contenido</label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe el primer mensaje del tema..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none resize-none text-sm"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={resetAndClose} disabled={submitting}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {submitting ? 'Creando...' : 'Crear Tema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
