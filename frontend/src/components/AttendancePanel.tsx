import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, CalendarDays, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSubjectStudents, type SubjectStudent } from '../services/grades.service';
import {
  recordAttendance,
  getSubjectAttendanceByDate,
  getStudentSubjectAttendance,
  type AttendanceStatus,
  type AttendanceRecord,
  type AttendanceStats,
} from '../services/attendance.service';

interface AttendancePanelProps {
  subjectId: number;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'PRESENT', label: 'Presente', activeClass: 'bg-green-600 text-white border-green-600' },
  { value: 'LATE', label: 'Tarde', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
  { value: 'EXCUSED', label: 'Justificado', activeClass: 'bg-blue-500 text-white border-blue-500' },
  { value: 'ABSENT', label: 'Ausente', activeClass: 'bg-red-600 text-white border-red-600' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export const AttendancePanel = ({ subjectId }: AttendancePanelProps) => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayStr());

  // Vista profesor
  const [students, setStudents] = useState<SubjectStudent[]>([]);
  const [statusByStudent, setStatusByStudent] = useState<Record<number, AttendanceStatus>>({});

  // Vista alumno
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [myStats, setMyStats] = useState<AttendanceStats | null>(null);

  const loadTeacherView = useCallback(async () => {
    const [studentsData, existingRecords] = await Promise.all([
      getSubjectStudents(subjectId),
      getSubjectAttendanceByDate(subjectId, date),
    ]);
    setStudents(studentsData);

    const statusMap: Record<number, AttendanceStatus> = {};
    for (const student of studentsData) {
      const existing = existingRecords.find((r) => r.studentId === student.id);
      statusMap[student.id] = existing?.status ?? 'PRESENT';
    }
    setStatusByStudent(statusMap);
  }, [subjectId, date]);

  const loadStudentView = useCallback(async () => {
    if (!user) return;
    const result = await getStudentSubjectAttendance(subjectId, user.id);
    setMyRecords(result.records);
    setMyStats(result.stats);
  }, [subjectId, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isTeacher) {
        await loadTeacherView();
      } else {
        await loadStudentView();
      }
    } catch (error) {
      console.error('Error cargando asistencia:', error);
    } finally {
      setLoading(false);
    }
  }, [isTeacher, loadTeacherView, loadStudentView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (students.length === 0) return;
    try {
      setSaving(true);
      await recordAttendance(
        subjectId,
        date,
        students.map((s) => ({ studentId: s.id, status: statusByStudent[s.id] ?? 'PRESENT' })),
      );
      await loadTeacherView();
    } catch {
      alert('Error al guardar la asistencia.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="animate-spin text-sky-600 mx-auto" />
      </div>
    );
  }

  // ---------------- VISTA ALUMNO ----------------
  if (!isTeacher) {
    if (!myStats || myStats.totalRecords === 0) {
      return (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
          Aún no hay registros de asistencia en esta materia.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-sky-50 border border-sky-100 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-white p-3 rounded-full text-sky-600 shadow-sm">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-sky-700 uppercase">Tasa de asistencia</p>
            <p className="text-3xl font-bold text-sky-800">
              {myStats.attendanceRate != null ? `${myStats.attendanceRate}%` : '—'}
            </p>
          </div>
          <div className="ml-auto grid grid-cols-4 gap-3 text-center">
            <div><p className="font-bold text-green-600">{myStats.present}</p><p className="text-xs text-gray-400">Presente</p></div>
            <div><p className="font-bold text-yellow-500">{myStats.late}</p><p className="text-xs text-gray-400">Tarde</p></div>
            <div><p className="font-bold text-blue-500">{myStats.excused}</p><p className="text-xs text-gray-400">Justif.</p></div>
            <div><p className="font-bold text-red-600">{myStats.absent}</p><p className="text-xs text-gray-400">Ausente</p></div>
          </div>
        </div>

        <div className="grid gap-2">
          {myRecords.map((r) => {
            const opt = STATUS_OPTIONS.find((o) => o.value === r.status);
            return (
              <div key={r.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center text-sm">
                <span className="text-gray-700">{new Date(r.date).toLocaleDateString()}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded border ${opt?.activeClass || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {opt?.label || r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------- VISTA PROFESOR ----------------
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 text-gray-600">
          <CalendarDays size={18} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-600 outline-none"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || students.length === 0}
          className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition shadow-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Guardar Asistencia
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed text-gray-400">
          No hay alumnos con inscripción activa en esta materia.
        </div>
      ) : (
        <div className="grid gap-2">
          {students.map((student) => (
            <div key={student.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  {student.name.charAt(0)}
                </div>
                <p className="font-bold text-gray-800">{student.name}</p>
              </div>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = statusByStudent[student.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setStatusByStudent((prev) => ({ ...prev, [student.id]: opt.value }))}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                        isActive ? opt.activeClass : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
