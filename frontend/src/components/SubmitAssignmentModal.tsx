import { useState } from 'react';
import { X, UploadCloud, FileText, Send, Loader2, AlertCircle } from 'lucide-react';
import { submitAssignment } from '../services/assignment.service';

interface SubmitAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: number;
  assignmentTitle: string;
  onSuccess: () => void;
}

// Interfaz para manejar errores de Axios de forma segura
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export const SubmitAssignmentModal = ({ isOpen, onClose, assignmentId, assignmentTitle, onSuccess }: SubmitAssignmentModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor selecciona un archivo para entregar.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Llamamos al servicio
      await submitAssignment(assignmentId, file, comment);

      onSuccess(); // Recargar datos en SubjectDetail
      onClose();   // Cerrar modal
    } catch (err: unknown) {
      console.error(err);
      // ✅ Manejo de errores tipado (sin 'any')
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al enviar la tarea.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <UploadCloud size={20} /> Entregar Tarea
            </h3>
            <p className="text-blue-100 text-xs mt-0.5 font-medium truncate max-w-xs">
              {assignmentTitle}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Área de carga de archivo */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tu Trabajo</label>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative group cursor-pointer
                ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:bg-gray-50 hover:border-blue-300'}`}>
                
                <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                    {file ? (
                        <>
                            <div className="bg-white p-3 rounded-full shadow-sm">
                                <FileText className="text-blue-600" size={32} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">{file.name}</p>
                                <p className="text-xs text-blue-600 font-medium mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded-full mt-2">
                                Archivo seleccionado
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="bg-gray-100 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                                <UploadCloud size={32} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700">Haz clic para subir tu archivo</p>
                                <p className="text-xs text-gray-400 mt-1">PDF, Word, Imágenes (Max 10MB)</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
          </div>

          {/* Comentarios */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Comentarios para el profesor (Opcional)</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none resize-none text-sm transition"
              placeholder="Escribe aquí cualquier nota adicional..."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          {/* Botones */}
          <div className="pt-2 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading || !file} 
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {loading ? 'Enviando...' : 'Entregar Tarea'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};