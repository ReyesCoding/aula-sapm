import { useEffect, useState } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { getSubjectStudents, createEvaluation, type SubjectStudent } from '../services/grades.service';

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

interface CreateEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: number;
  onSuccess: () => void;
}

export const CreateEvaluationModal = ({ isOpen, onClose, subjectId, onSuccess }: CreateEvaluationModalProps) => {
  const [students, setStudents] = useState<SubjectStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentId, setStudentId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [score, setScore] = useState('');
  const [weight, setWeight] = useState('1');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingStudents(true);
    setError(null);
    getSubjectStudents(subjectId)
      .then(setStudents)
      .catch(() => setError('No se pudo cargar la lista de alumnos.'))
      .finally(() => setLoadingStudents(false));
  }, [isOpen, subjectId]);

  const resetForm = () => {
    setStudentId('');
    setTitle('');
    setScore('');
    setWeight('1');
    setComment('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericScore = Number(score);
    if (!studentId) {
      setError('Selecciona un alumno.');
      return;
    }
    if (!title.trim()) {
      setError('El título de la evaluación es obligatorio.');
      return;
    }
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      setError('La nota debe ser un número entre 0 y 100.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createEvaluation(subjectId, {
        studentId: Number(studentId),
        title: title.trim(),
        score: numericScore,
        weight: weight ? Number(weight) : 1,
        comment: comment.trim() || undefined,
      });
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.response?.data?.message || errorObj.message || 'Error al guardar la calificación.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">

        <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center text-white rounded-t-xl">
          <h3 className="font-bold text-lg">Nueva Calificación</h3>
          <button onClick={handleClose} className="hover:bg-white/20 p-1 rounded transition-colors">
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
            <label className="block text-sm font-bold text-gray-700 mb-2">Alumno</label>
            {loadingStudents ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <Loader2 className="animate-spin" size={16} /> Cargando alumnos...
              </div>
            ) : students.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No hay alumnos activos inscritos en esta materia.</p>
            ) : (
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none text-sm"
              >
                <option value="">Selecciona un alumno...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Ej: "Participación en clase", "Proyecto final"'
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nota (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Peso</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Comentario (Opcional)</label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none resize-none text-sm"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={handleClose} disabled={submitting}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || loadingStudents}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {submitting ? 'Guardando...' : 'Guardar Calificación'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
