import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, AlertCircle, UploadCloud, FileText } from 'lucide-react';
import api from '../services/api'; 
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  initialData?: {
      id: number;
      title: string;
      description: string;
      dueDate: string;
      subjectId: number;
      attachmentUrl?: string;
  } | null;
}

interface Subject {
  id: number;
  name: string;
  code?: string;
  teacherId?: number;
  teacher?: { id: number; name: string; };
}

interface ApiError {
    response?: { data?: { message?: string; }; };
    message?: string;
}

export const CreateTaskModal = ({ isOpen, onClose, onTaskCreated, initialData }: Props) => {
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subjectId, setSubjectId] = useState<string>(''); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    try {
      setLoadingSubjects(true);
      const res = await api.get('/subjects'); 
      const userId = Number(user?.id);
      const mySubjects = res.data.filter((s: Subject) => {
          const teacherId = s.teacherId ? Number(s.teacherId) : (s.teacher ? Number(s.teacher.id) : null);
          return teacherId === userId;
      });
      setSubjects(mySubjects);
    } catch (err) {
      console.error(err);
      setError('Error cargando la lista de materias.');
    } finally {
      setLoadingSubjects(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadSubjects();
      
      if (initialData) {
          setTitle(initialData.title);
          setDescription(initialData.description || '');
          
          // 👇 SENIOR FIX: Convertir ISO string a formato compatible con datetime-local (YYYY-MM-DDTHH:mm)
          // Cortamos los segundos y la zona horaria para que el input lo lea bien
          const dateObj = new Date(initialData.dueDate);
          // Ajuste para zona horaria local (truco para inputs datetime-local)
          const offset = dateObj.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(dateObj.getTime() - offset)).toISOString().slice(0, 16);
          
          setDueDate(localISOTime);
          setSubjectId(String(initialData.subjectId));
      } else {
          setTitle('');
          setDescription('');
          setDueDate('');
          setSubjectId('');
      }
      setSelectedFile(null);
      setError(null);
    }
  }, [isOpen, loadSubjects, initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!subjectId) {
      setError('Debes seleccionar una materia.');
      return;
    }

    try {
      setLoading(true); 
      setError(null);

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      // 👇 Importante: Enviamos la fecha completa ISO al backend
      formData.append('dueDate', new Date(dueDate).toISOString()); 
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (initialData) {
          await api.patch(`/assignments/${initialData.id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
      } else {
          formData.append('subjectId', subjectId);
          await api.post('/assignments', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
      }

      onTaskCreated(); 
      onClose();       
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      console.error(err);
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al guardar la tarea.');
    } finally {
      setLoading(false); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        
        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Save size={20} /> {initialData ? 'Editar Tarea' : 'Nueva Tarea'}
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Título</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="Ej: Examen Parcial de Álgebra"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Materia</label>
            <select 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              disabled={loadingSubjects || !!initialData}
            >
              <option value="">-- Selecciona una materia --</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} {subject.code ? `(${subject.code})` : ''}
                </option>
              ))}
            </select>
            {loadingSubjects && <p className="text-xs text-gray-400 mt-1">Cargando materias...</p>}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
                {initialData ? 'Reemplazar Archivo (Opcional)' : 'Material Adjunto (Opcional)'}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative group">
                <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                    {selectedFile ? (
                        <>
                            <FileText className="text-blue-600" size={32} />
                            <p className="text-sm font-bold text-gray-800">{selectedFile.name}</p>
                            <p className="text-xs text-green-600 font-bold">Listo para subir</p>
                        </>
                    ) : (
                        <>
                            <UploadCloud size={32} className="group-hover:text-blue-600 transition-colors" />
                            <p className="text-sm font-medium">Arrastra un archivo o haz clic aquí</p>
                            <p className="text-xs text-gray-400">PDF, Word, Imágenes (Max 10MB)</p>
                        </>
                    )}
                </div>
            </div>
            {initialData?.attachmentUrl && !selectedFile && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <FileText size={12}/> Archivo actual: {initialData.attachmentUrl}
                </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Fecha y Hora de Entrega</label>
            {/* 👇 CAMBIO: datetime-local para control preciso */}
            <input 
              type="datetime-local" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none resize-none"
              placeholder="Detalles de la tarea..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-4 flex gap-3">
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
              disabled={loading} 
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {loading ? 'Guardando...' : (initialData ? 'Actualizar Tarea' : 'Crear Tarea')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};