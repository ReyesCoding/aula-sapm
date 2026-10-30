import { useEffect, useState } from 'react';
import { X, Save, Loader2, BookOpen, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createSubject } from '../services/subject.service';
import { searchUsers } from '../services/user.service';
import { getCenters, type EducationalCenter } from '../services/center.service';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

interface CreateSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface TeacherOption {
  id: number;
  name: string;
  email: string;
}

export const CreateSubjectModal = ({ isOpen, onClose, onCreated }: CreateSubjectModalProps) => {
  const { user } = useAuth();
  const needsTeacherPicker = user?.role === 'CENTRO' || user?.role === 'ADMIN';
  const needsCenterPicker = user?.role === 'ADMIN';

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [teacherId, setTeacherId] = useState<number | ''>('');
  const [centerId, setCenterId] = useState<number | ''>('');

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [centers, setCenters] = useState<EducationalCenter[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setCode('');
    setDescription('');
    setTeacherId('');
    setCenterId('');
    setError(null);

    if (needsTeacherPicker) {
      searchUsers('', 'TEACHER').then(setTeachers).catch(() => setTeachers([]));
    }
    if (needsCenterPicker) {
      getCenters().then(setCenters).catch(() => setCenters([]));
    }
  }, [isOpen, needsTeacherPicker, needsCenterPicker]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Nombre y código son obligatorios.');
      return;
    }
    if (needsTeacherPicker && !teacherId) {
      setError('Selecciona el profesor titular.');
      return;
    }
    if (needsCenterPicker && !centerId) {
      setError('Selecciona el centro educativo.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createSubject({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        teacherId: needsTeacherPicker ? Number(teacherId) : undefined,
        educationalCenterId: needsCenterPicker ? Number(centerId) : undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al crear la materia.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 bg-primary text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <BookOpen size={20} /> Nueva Materia
          </h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Materia</label>
            <input
              required
              type="text"
              placeholder="Ej: Matemáticas 4to A"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Único</label>
            <input
              required
              type="text"
              placeholder="MAT-2026-A"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Los estudiantes usarán este código para inscribirse.</p>
          </div>

          {needsTeacherPicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profesor Titular</label>
              <select
                required
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Selecciona un profesor...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
              {teachers.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No hay profesores disponibles todavía. Crea uno primero en Usuarios.</p>
              )}
            </div>
          )}

          {needsCenterPicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro Educativo</label>
              <select
                required
                value={centerId}
                onChange={(e) => setCenterId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Selecciona un centro...</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pt-2 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Crear Materia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
