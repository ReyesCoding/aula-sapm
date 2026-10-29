import api from './api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  id: number;
  subjectId: number;
  studentId: number;
  date: string;
  status: AttendanceStatus;
  comment: string | null;
  recordedById: number;
  student?: { id: number; name: string };
}

export interface AttendanceStats {
  subjectId: number;
  studentId: number;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number | null;
}

interface AttendanceInput {
  studentId: number;
  status: AttendanceStatus;
  comment?: string;
}

// Profesor: toma/actualiza asistencia de uno o varios alumnos para una fecha (upsert)
export const recordAttendance = async (
  subjectId: number,
  date: string,
  records: AttendanceInput[],
): Promise<AttendanceRecord[]> => {
  const { data } = await api.post<AttendanceRecord[]>(`/attendance/subjects/${subjectId}`, { date, records });
  return data;
};

// Profesor: roster de asistencia de una materia para una fecha específica
export const getSubjectAttendanceByDate = async (subjectId: number, date: string): Promise<AttendanceRecord[]> => {
  const { data } = await api.get<AttendanceRecord[]>(`/attendance/subjects/${subjectId}`, { params: { date } });
  return data;
};

// Alumno: su propio historial + stats en una materia
export const getStudentSubjectAttendance = async (
  subjectId: number,
  studentId: number,
): Promise<{ records: AttendanceRecord[]; stats: AttendanceStats }> => {
  const { data } = await api.get(`/attendance/subjects/${subjectId}/students/${studentId}`);
  return data;
};
