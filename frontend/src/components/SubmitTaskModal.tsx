import { useState } from 'react';
import { X, UploadCloud, FileText, Send, Loader2, AlertCircle } from 'lucide-react';
import { submitAssignment } from '../services/assignment.service';

// 👇 1. Definimos la interfaz del error para evitar el 'any'
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: number;
  assignmentTitle: string;
  onSubmitted: () => void;
}

export const SubmitTaskModal = ({ isOpen, onClose, assignmentId, assignmentTitle, onSubmitted }: Props) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Debes adjuntar un archivo para entregar la tarea.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await submitAssignment(assignmentId, selectedFile);
      
      onSubmitted(); 
      onClose();     
    } catch (err: unknown) { // 👈 2. CORRECCIÓN: Usamos 'unknown'
      const errorObj = err as ApiError; // Casteamos al tipo definido arriba
      const msg = errorObj.response?.data?.message || "Error al entregar la tarea.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-gray-800">Entregar Tarea</h3>
            <p className="text-xs text-gray-500 truncate max-w-[250px]">{assignmentTitle}</p>
          </div>
          <button onClick={onClose} className="hover:bg-gray-100 p-1 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Area de Carga */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Tu Trabajo</label>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative group ${selectedFile ? 'border-primary bg-blue-50' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}`}>
                <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                <div className="flex flex-col items-center justify-center gap-3">
                    {selectedFile ? (
                        <>
                            <div className="bg-white p-3 rounded-full shadow-sm text-primary">
                                <FileText size={32} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">{selectedFile.name}</p>
                                <p className="text-xs text-green-600 font-bold mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <p className="text-xs text-gray-400">Clic para cambiar</p>
                        </>
                    ) : (
                        <>
                            <div className="bg-gray-100 p-3 rounded-full group-hover:bg-white group-hover:shadow-sm transition-all text-gray-400 group-hover:text-primary">
                                <UploadCloud size={32} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Haz clic o arrastra tu archivo</p>
                                <p className="text-xs text-gray-400 mt-1">PDF, Word, Imágenes</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading || !selectedFile} 
              className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-md shadow-green-100 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {loading ? 'Enviando...' : 'Entregar'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};