import { useState } from 'react';
import { X, Save, Loader2, BookOpen } from 'lucide-react';
import { createCourse } from '../services/course.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: () => void;
}

export const CreateCourseModal = ({ isOpen, onClose, onCourseCreated }: Props) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '', // Ej: MAT-4A-2025
    description: '',
    subjectId: '', // ID de la materia (Matemáticas)
    teacherId: ''  // ID del profesor que la dará
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createCourse({
        ...formData,
        subjectId: Number(formData.subjectId),
        teacherId: Number(formData.teacherId)
      });
      onCourseCreated();
      onClose();
      setFormData({ name: '', code: '', description: '', subjectId: '', teacherId: '' });
    } catch (error) {
      alert('Error al crear el curso. Verifica que el Código no exista y el ID del profesor sea correcto.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        
        <div className="flex justify-between items-center px-6 py-4 bg-primary text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <BookOpen size={20}/> Nuevo Curso
          </h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Curso</label>
            <input required type="text" placeholder="Ej: Matemáticas 4to A"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código Único</label>
                <input required type="text" placeholder="MAT-2025-A"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none uppercase"
                  value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Materia</label>
                <input required type="number" placeholder="Ej: 1"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  value={formData.subjectId} onChange={e => setFormData({...formData, subjectId: e.target.value})}
                />
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Profesor Titular</label>
            <input required type="number" placeholder="Ej: 2"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
              value={formData.teacherId} onChange={e => setFormData({...formData, teacherId: e.target.value})}
            />
            <p className="text-xs text-gray-500 mt-1">Ingresa el ID del usuario Teacher.</p>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
             <textarea className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
               rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
             />
          </div>

          <div className="pt-2 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded text-sm font-medium flex items-center gap-2">
              {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />} Crear Curso
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};