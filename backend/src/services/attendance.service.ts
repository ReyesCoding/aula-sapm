import prisma from '../prisma/client';
import { AttendanceStatus, EnrollmentStatus } from '@prisma/client';

/**
 * Estadísticas de asistencia (Bloque 4, v2.0).
 *
 * `attendanceRate` cuenta PRESENT y LATE como "asistió" y excluye del
 * denominador los días EXCUSED (ausencia justificada no debería penalizar
 * la tasa de asistencia). `null` cuando no hay ningún registro contable
 * todavía, para no confundir "sin datos" con "0% de asistencia".
 */

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

export async function computeAttendanceStats(studentId: number, subjectId: number): Promise<AttendanceStats> {
  const records = await prisma.attendance.findMany({
    where: { studentId, subjectId },
    select: { status: true },
  });

  const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const absent = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const late = records.filter((r) => r.status === AttendanceStatus.LATE).length;
  const excused = records.filter((r) => r.status === AttendanceStatus.EXCUSED).length;
  const totalRecords = records.length;

  const countable = totalRecords - excused;
  const attendanceRate = countable > 0 ? Math.round(((present + late) / countable) * 1000) / 10 : null;

  return { subjectId, studentId, totalRecords, present, absent, late, excused, attendanceRate };
}

export interface StudentAttendanceHistorySubject {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  stats: AttendanceStats;
}

export interface StudentAttendanceHistoryResult {
  studentId: number;
  subjects: StudentAttendanceHistorySubject[];
  overallAttendanceRate: number | null;
}

/**
 * Resumen de asistencia de un alumno en todas las materias donde tiene
 * inscripción ACTIVE. `overallAttendanceRate` es la media simple de las
 * tasas de materia que sí tienen registros (cada materia pesa igual).
 */
export async function computeStudentAttendanceHistory(studentId: number): Promise<StudentAttendanceHistoryResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: EnrollmentStatus.ACTIVE },
    include: { subject: { select: { id: true, name: true, code: true } } },
  });

  const subjects: StudentAttendanceHistorySubject[] = await Promise.all(
    enrollments.map(async (e) => {
      const stats = await computeAttendanceStats(studentId, e.subjectId);
      return { subjectId: e.subjectId, subjectName: e.subject.name, subjectCode: e.subject.code, stats };
    })
  );

  const withRate = subjects.filter(
    (s): s is StudentAttendanceHistorySubject & { stats: AttendanceStats & { attendanceRate: number } } =>
      s.stats.attendanceRate != null
  );
  const overallAttendanceRate = withRate.length
    ? Math.round((withRate.reduce((sum, s) => sum + s.stats.attendanceRate, 0) / withRate.length) * 10) / 10
    : null;

  return { studentId, subjects, overallAttendanceRate };
}
