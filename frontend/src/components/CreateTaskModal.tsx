import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, AlertCircle, UploadCloud, FileText } from 'lucide-react'; // 👈 Agregamos iconos de archivo
import { createAssignment } from '../services/assignment.service';
import { getCourses } from '../services/course.service';
import type { Course } from '../services/course.service';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export const CreateTaskModal = ({ isOpen, onClose, onTaskCreated }: Props) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [courseId, setCourseId] = useState<number | string>('');
  
  // 👇 ESTADO PARA EL ARCHIVO
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  // Cargar cursos con seguridad (useCallback)
  const loadCourses = useCallback(async () => {
    try {
      setLoadingCourses(true);
      const data = await getCourses();
      
      const userId = Number(user?.id);
      
      const myCourses = data.filter(c => {
        // Validación robusta: backend puede enviar teacherId o teacher.id
        const courseTeacherId = c.teacherId ? Number(c.teacherId) : Number(c.teacher?.id);
        return courseTeacherId === userId;
      });
      
      setCourses(myCourses);
    } catch (err) {
      console.error(err);
      setError('Error cargando la lista de cursos.');
    } finally {
      setLoadingCourses(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadCourses();
      // Resetear formulario completo
      setTitle('');
      setDescription('');
      setDueDate('');
      setCourseId('');
      setSelectedFile(null); // 👈 Limpiar archivo
      setError(null);
    }
  }, [isOpen, loadCourses]);

  // 👇 MANEJADOR DE SELECCIÓN DE ARCHIVO
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!courseId) {
      setError('Debes seleccionar un curso.');
      return;
    }

    const selectedCourse = courses.find(c => c.id === Number(courseId));
    if (!selectedCourse) {
        setError('Error: Curso no válido.');
        return;
    }

    try {
      setLoading(true); 
      setError(null);

      // Preparamos los datos base
      const assignmentData = {
        title,
        description,
        dueDate,
        courseId: Number(courseId),
        subjectId: selectedCourse.subject.id
      };

      // 👇 ENVIAMOS DATA + ARCHIVO
      await createAssignment(assignmentData, selectedFile);

      onTaskCreated(); 
      onClose();       
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }, message?: string };
      setError(errorObj.response?.data?.message || 'Error al crear la tarea.');
      setLoading(false); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Save size={20} /> Nueva Tarea
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="Ej: Examen Parcial de Álgebra"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Curso</label>
            <select 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              disabled={loadingCourses}
            >
              <option value="">-- Selecciona un curso --</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
            {loadingCourses && <p className="text-xs text-gray-400 mt-1">Cargando cursos...</p>}
          </div>

          {/* 👇 SECCIÓN DE SUBIDA DE ARCHIVOS (VISUALMENTE MEJORADA) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Material Adjunto (Opcional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors relative group">
                <input 
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                    {selectedFile ? (
                        <>
                            <FileText className="text-primary" size={32} />
                            <p className="text-sm font-bold text-gray-800">{selectedFile.name}</p>
                            <p className="text-xs text-green-600 font-bold">Listo para subir</p>
                        </>
                    ) : (
                        <>
                            <UploadCloud size={32} className="group-hover:text-primary transition-colors" />
                            <p className="text-sm font-medium">Arrastra un archivo o haz clic aquí</p>
                            <p className="text-xs text-gray-400">PDF, Word, Imágenes (Max 10MB)</p>
                        </>
                    )}
                </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Fecha de Entrega</label>
            <input 
              type="datetime-local" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
              placeholder="Detalles de la tarea..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Footer de Acciones */}
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
              className="flex-1 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {loading ? 'Guardando...' : 'Crear Tarea'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};