import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Award, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSubjectStudents,
  getSubjectEvaluations,
  getSubjectAverage,
  deleteEvaluation,
  type SubjectStudent,
  type Evaluation,
  type SubjectAverageResult,
} from '../services/grades.service';
import { CreateEvaluationModal } from './CreateEvaluationModal';

interface GradesPanelProps {
  subjectId: number;
}

const sourceLabel: Record<string, string> = {
  ASSIGNMENT: 'Tarea',
  EXAM: 'Examen',
  EVALUATION: 'Calificación',
};

export const GradesPanel = ({ subjectId }: GradesPanelProps) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Vista profesor
  const [students, setStudents] = useState<SubjectStudent[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  // Vista alumno
  const [myAverage, setMyAverage] = useState<SubjectAverageResult | null>(null);

  const loadTeacherView = useCallback(async () => {
    const [studentsData, evaluationsData] = await Promise.all([
      getSubjectStudents(subjectId),
      getSubjectEvaluations(subjectId),
    ]);
    setStudents(studentsData);
    setEvaluations(evaluationsData);
  }, [subjectId]);

  const loadStudentView = useCallback(async () => {
    const average = await getSubjectAverage(subjectId);
    setMyAverage(average);
  }, [subjectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isTeacher) {
        await loadTeacherView();
      } else {
        await loadStudentView();
      }
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
    } finally {
      setLoading(false);
    }
  }, [isTeacher, loadTeacherView, loadStudentView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta calificación?')) return;
    try {
      await deleteEvaluation(id);
      loadData();
    } catch {
      alert('Error al eliminar la calificación.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="animate-spin text-emerald-600 mx-auto" />
      </div>
    );
  }

  // ---------------- VISTA ALUMNO ----------------
  if (!isTeacher) {
    if (!myAverage || myAverage.breakdown.length === 0) {
      return (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
          Aún no tienes calificaciones registradas en esta materia.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-white p-3 rounded-full text-emerald-600 shadow-sm">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase">Promedio de la materia</p>
            <p className="text-3xl font-bold text-emerald-800">
              {myAverage.average != null ? myAverage.average.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {myAverage.breakdown.map((item) => (
            <div key={`${item.source}-${item.id}`} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500 mr-2">
                  {sourceLabel[item.source] || item.source}
                </span>
                <span className="font-medium text-gray-800">{item.label}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-700">{item.score.toFixed(1)}</span>
                <span className="text-xs text-gray-400 ml-1">(peso {item.weight})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------- VISTA PROFESOR ----------------
  const evaluationsByStudent = new Map<number, Evaluation[]>();
  for (const ev of evaluations) {
    const list = evaluationsByStudent.get(ev.studentId) || [];
    list.push(ev);
    evaluationsByStudent.set(ev.studentId, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium"
        >
          <Plus size={18} /> Nueva Calificación
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
          No hay alumnos con inscripción activa en esta materia.
        </div>
      ) : (
        <div className="grid gap-4">
          {students.map((student) => {
            const studentEvals = evaluationsByStudent.get(student.id) || [];
            const totalWeight = studentEvals.reduce((sum, e) => sum + e.weight, 0);
            const average = totalWeight > 0
              ? studentEvals.reduce((sum, e) => sum + e.score * e.weight, 0) / totalWeight
              : null;

            return (
              <div key={student.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                  </div>
                  {average != null && (
                    <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <Award size={16} /> {average.toFixed(1)}
                    </div>
                  )}
                </div>

                {studentEvals.length === 0 ? (
                  <p className="text-sm text-gray-400 italic pl-12">Sin calificaciones registradas aún.</p>
                ) : (
                  <div className="space-y-2 pl-12">
                    {studentEvals.map((ev) => (
                      <div key={ev.id} className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        <span className="text-gray-700 font-medium">{ev.title} <span className="text-gray-400">(peso {ev.weight})</span></span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-800">{ev.score}</span>
                          <button onClick={() => handleDelete(ev.id)} className="text-gray-400 hover:text-red-600 transition" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateEvaluationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        subjectId={subjectId}
        onSuccess={loadData}
      />
    </div>
  );
};
