import { Request, Response } from 'express';
import { AttendanceStatus, EnrollmentStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';
import { loadSubjectOrThrow } from '../services/forum.policy';
import { canManageAttendance, assertCanViewStudentAttendance } from '../services/attendance.policy';
import { computeAttendanceStats, computeStudentAttendanceHistory } from '../services/attendance.service';

/** Normaliza a medianoche UTC: un registro por alumno/materia/día, sin importar la hora de captura. */
function parseDateOnly(value: string): Date {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new HttpError(400, 'Fecha inválida');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const VALID_STATUSES: string[] = Object.values(AttendanceStatus);

// POST /api/attendance/subjects/:subjectId
// body: { date: "YYYY-MM-DD", records: [{ studentId, status, comment? }, ...] }
// Registra o actualiza (upsert) la asistencia de uno o varios alumnos para una fecha.
export const recordAttendance = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const { date, records } = req.body as {
    date?: string;
    records?: Array<{ studentId: number; status: AttendanceStatus; comment?: string }>;
  };

  if (!date || !Array.isArray(records) || records.length === 0) {
    throw new HttpError(400, 'date y records (al menos uno) son obligatorios');
  }

  const subject = await loadSubjectOrThrow(subjectId);
  if (!canManageAttendance(user, subject)) {
    throw new HttpError(403, 'No tienes permiso para tomar asistencia en esta materia');
  }

  const day = parseDateOnly(date);

  const saved = [];
  for (const r of records) {
    if (!r.studentId || !r.status || !VALID_STATUSES.includes(r.status)) {
      throw new HttpError(400, `Registro inválido para studentId=${r.studentId}`);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_subjectId: { studentId: r.studentId, subjectId } },
    });
    if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new HttpError(400, `El estudiante ${r.studentId} no tiene una inscripción activa en esta materia`);
    }

    const row = await prisma.attendance.upsert({
      where: { subjectId_studentId_date: { subjectId, studentId: r.studentId, date: day } },
      update: { status: r.status, comment: r.comment ?? null, recordedById: user.userId },
      create: {
        subjectId,
        studentId: r.studentId,
        date: day,
        status: r.status,
        comment: r.comment ?? null,
        recordedById: user.userId,
        educationalCenterId: subject.educationalCenterId,
      },
    });
    saved.push(row);
  }

  res.status(201).json(saved);
});

// GET /api/attendance/subjects/:subjectId?date=YYYY-MM-DD   (roster de un día, para quien gestiona la materia)
export const getSubjectAttendanceByDate = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const dateParam = req.query.date as string | undefined;
  if (!dateParam) throw new HttpError(400, 'Debes indicar ?date=YYYY-MM-DD');

  const subject = await loadSubjectOrThrow(subjectId);
  if (!canManageAttendance(user, subject)) {
    throw new HttpError(403, 'No tienes permiso para ver la asistencia de esta materia');
  }

  const day = parseDateOnly(dateParam);
  const records = await prisma.attendance.findMany({
    where: { subjectId, date: day },
    include: { student: { select: { id: true, name: true } } },
    orderBy: { student: { name: 'asc' } },
  });

  res.json(records);
});

// GET /api/attendance/subjects/:subjectId/students/:studentId?from=&to=
// Historial de un alumno en una materia (quien puede ver sus calificaciones/asistencia).
export const getStudentSubjectAttendance = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const studentId = Number(req.params.studentId);

  await assertCanViewStudentAttendance(user, studentId);

  const { from, to } = req.query as { from?: string; to?: string };
  const records = await prisma.attendance.findMany({
    where: {
      subjectId,
      studentId,
      ...(from ? { date: { gte: parseDateOnly(from) } } : {}),
      ...(to ? { date: { lte: parseDateOnly(to) } } : {}),
    },
    orderBy: { date: 'desc' },
  });

  const stats = await computeAttendanceStats(studentId, subjectId);
  res.json({ records, stats });
});

// GET /api/attendance/students/:studentId/history   (resumen por todas las materias ACTIVE)
export const getStudentAttendanceHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const studentId = Number(req.params.studentId);

  await assertCanViewStudentAttendance(user, studentId);

  const history = await computeStudentAttendanceHistory(studentId);
  res.json(history);
});
