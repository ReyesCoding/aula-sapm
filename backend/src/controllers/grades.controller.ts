import { Request, Response } from 'express';
import { RoleName, NotificationType, EnrollmentStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError, requireUserCenter } from '../utils/tenant';
import { loadSubjectOrThrow } from '../services/forum.policy';
import { canGradeSubject, assertCanViewStudentGrades } from '../services/grades.policy';
import { computeSubjectAverage, computeStudentHistory } from '../services/grades.service';
import { createNotification } from '../services/notification.service';

// POST /api/grades/subjects/:subjectId/evaluations   (profesor dueño, o Centro/Admin)
export const createEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const { studentId, title, score, weight, comment, periodId } = req.body as {
    studentId?: number;
    title?: string;
    score?: number;
    weight?: number;
    comment?: string;
    periodId?: number;
  };

  if (!studentId || !title?.trim() || score == null) {
    throw new HttpError(400, 'studentId, title y score son obligatorios');
  }
  if (score < 0 || score > 100) {
    throw new HttpError(400, 'score debe estar entre 0 y 100');
  }

  const subject = await loadSubjectOrThrow(subjectId);
  if (!canGradeSubject(user, subject)) {
    throw new HttpError(403, 'No tienes permiso para calificar esta materia');
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_subjectId: { studentId, subjectId } },
  });
  if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
    throw new HttpError(400, 'El estudiante no tiene una inscripción activa en esta materia');
  }

  const evaluation = await prisma.evaluation.create({
    data: {
      subjectId,
      studentId,
      teacherId: user.userId,
      periodId: periodId ?? null,
      title: title.trim(),
      score,
      weight: weight ?? 1,
      comment: comment ?? null,
      educationalCenterId: subject.educationalCenterId,
    },
  });

  await createNotification({
    userId: studentId,
    type: NotificationType.GRADE_PUBLISHED,
    title: `Nueva calificación en ${subject.name}`,
    body: `${title.trim()}: ${score}`,
    link: `/grades/subjects/${subjectId}`,
    educationalCenterId: subject.educationalCenterId,
  });

  res.status(201).json(evaluation);
});

// GET /api/grades/subjects/:subjectId/evaluations?studentId=
// - STUDENT: siempre ve las suyas (ignora ?studentId).
// - Otros roles: deben indicar ?studentId= (y pasar assertCanViewStudentGrades),
//   excepto quien puede calificar la materia, que sin ?studentId= ve el listado completo.
export const listEvaluations = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const queryStudentId = req.query.studentId ? Number(req.query.studentId) : undefined;

  const subject = await loadSubjectOrThrow(subjectId);
  const canGrade = canGradeSubject(user, subject);

  if (user.role !== RoleName.STUDENT && !queryStudentId) {
    if (!canGrade) {
      throw new HttpError(400, 'Debes indicar ?studentId=');
    }
    const evaluations = await prisma.evaluation.findMany({
      where: { subjectId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(evaluations);
    return;
  }

  const targetStudentId = user.role === RoleName.STUDENT ? user.userId : (queryStudentId as number);

  if (!canGrade) {
    await assertCanViewStudentGrades(user, targetStudentId);
  }

  const evaluations = await prisma.evaluation.findMany({
    where: { subjectId, studentId: targetStudentId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(evaluations);
});

// PATCH /api/grades/evaluations/:id
export const updateEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const id = Number(req.params.id);
  const { title, score, weight, comment, periodId } = req.body as {
    title?: string;
    score?: number;
    weight?: number;
    comment?: string | null;
    periodId?: number | null;
  };

  const evaluation = await prisma.evaluation.findUnique({ where: { id }, include: { subject: true } });
  if (!evaluation) throw new HttpError(404, 'Evaluación no encontrada');

  if (!canGradeSubject(user, evaluation.subject)) {
    throw new HttpError(403, 'No tienes permiso para editar esta evaluación');
  }
  if (score != null && (score < 0 || score > 100)) {
    throw new HttpError(400, 'score debe estar entre 0 y 100');
  }

  const updated = await prisma.evaluation.update({
    where: { id },
    data: {
      ...(title != null ? { title: title.trim() } : {}),
      ...(score != null ? { score } : {}),
      ...(weight != null ? { weight } : {}),
      ...(comment !== undefined ? { comment } : {}),
      ...(periodId !== undefined ? { periodId } : {}),
    },
  });

  res.json(updated);
});

// DELETE /api/grades/evaluations/:id
export const deleteEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const id = Number(req.params.id);

  const evaluation = await prisma.evaluation.findUnique({ where: { id }, include: { subject: true } });
  if (!evaluation) throw new HttpError(404, 'Evaluación no encontrada');

  if (!canGradeSubject(user, evaluation.subject)) {
    throw new HttpError(403, 'No tienes permiso para borrar esta evaluación');
  }

  await prisma.evaluation.delete({ where: { id } });
  res.json({ message: 'Evaluación eliminada' });
});

// GET /api/grades/subjects/:subjectId/average?studentId=
export const getSubjectAverage = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const queryStudentId = req.query.studentId ? Number(req.query.studentId) : undefined;

  const studentId = user.role === RoleName.STUDENT ? user.userId : queryStudentId;
  if (!studentId) throw new HttpError(400, 'Debes indicar ?studentId=');

  await assertCanViewStudentGrades(user, studentId);

  const result = await computeSubjectAverage(studentId, subjectId);
  res.json(result);
});

// GET /api/grades/students/:studentId/history
export const getStudentHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const studentId = Number(req.params.studentId);

  await assertCanViewStudentGrades(user, studentId);

  const history = await computeStudentHistory(studentId);
  res.json(history);
});

// GET /api/grades/subjects/:subjectId/students   (roster de alumnos activos, para la UI de calificar)
export const listSubjectStudents = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);

  const subject = await loadSubjectOrThrow(subjectId);
  if (!canGradeSubject(user, subject)) {
    throw new HttpError(403, 'No tienes permiso para ver el listado de esta materia');
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { subjectId, status: EnrollmentStatus.ACTIVE },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { student: { name: 'asc' } },
  });

  res.json(enrollments.map((e) => e.student));
});

// GET /api/grades/periods   (lista los periodos del propio centro + los globales; ADMIN ve todos)
export const listPeriods = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const centerId = requireUserCenter(authReq);

  const periods = await prisma.gradePeriod.findMany({
    where: centerId === null ? {} : { OR: [{ educationalCenterId: centerId }, { educationalCenterId: null }] },
    orderBy: { startDate: 'desc' },
  });
  res.json(periods);
});

// POST /api/grades/periods   (solo ADMIN o CENTRO)
export const createPeriod = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const user = authReq.user!;
  if (user.role !== RoleName.ADMIN && user.role !== RoleName.CENTRO) {
    throw new HttpError(403, 'Solo Admin o Centro pueden crear periodos académicos');
  }

  const { name, startDate, endDate } = req.body as { name?: string; startDate?: string; endDate?: string };
  if (!name?.trim() || !startDate || !endDate) {
    throw new HttpError(400, 'name, startDate y endDate son obligatorios');
  }

  const centerId = requireUserCenter(authReq); // null si ADMIN -> periodo de plataforma

  const period = await prisma.gradePeriod.create({
    data: {
      name: name.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      educationalCenterId: centerId,
    },
  });

  res.status(201).json(period);
});
