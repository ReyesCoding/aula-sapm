import prisma from '../prisma/client';
import { RoleName, EnrollmentStatus, CalendarEventScope, Prisma } from '@prisma/client';
import { CalendarActor } from './calendar.policy';

/**
 * Agregación de calendario (Bloque 5, v2.0): junta, para un usuario dado, los
 * eventos PERSONAL propios, los CENTER de su centro (más los globales,
 * educationalCenterId null, igual semántica que GradePeriod), y los SUBJECT
 * de las materias a las que tiene acceso según su rol — mismo criterio de
 * "qué materias ve" que getAllowedContactIds en messaging.policy.ts.
 */

async function getVisibleSubjectIds(actor: CalendarActor): Promise<number[] | 'ALL'> {
  if (actor.role === RoleName.ADMIN) return 'ALL';

  if (actor.role === RoleName.CENTRO) {
    const subjects = await prisma.subject.findMany({
      where: { educationalCenterId: actor.educationalCenterId },
      select: { id: true },
    });
    return subjects.map((s) => s.id);
  }

  if (actor.role === RoleName.TEACHER) {
    const subjects = await prisma.subject.findMany({
      where: { teacherId: actor.userId },
      select: { id: true },
    });
    return subjects.map((s) => s.id);
  }

  if (actor.role === RoleName.STUDENT) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: actor.userId, status: EnrollmentStatus.ACTIVE },
      select: { subjectId: true },
    });
    return enrollments.map((e) => e.subjectId);
  }

  if (actor.role === RoleName.PARENT) {
    const children = await prisma.parentChild.findMany({
      where: { parentId: actor.userId },
      select: { childId: true },
    });
    const childIds = children.map((c) => c.childId);
    if (childIds.length === 0) return [];
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: childIds }, status: EnrollmentStatus.ACTIVE },
      select: { subjectId: true },
    });
    return Array.from(new Set(enrollments.map((e) => e.subjectId)));
  }

  return [];
}

export interface ListEventsRange {
  from?: Date;
  to?: Date;
}

export async function listVisibleEvents(actor: CalendarActor, range: ListEventsRange) {
  const dateFilter: Prisma.CalendarEventWhereInput = {
    ...(range.from ? { endsAt: { gte: range.from } } : {}),
    ...(range.to ? { startsAt: { lte: range.to } } : {}),
  };

  const subjectIds = await getVisibleSubjectIds(actor);

  const centerFilter: Prisma.CalendarEventWhereInput =
    actor.role === RoleName.ADMIN
      ? {} // Admin ve eventos CENTER de todos los centros + los globales
      : { OR: [{ educationalCenterId: actor.educationalCenterId }, { educationalCenterId: null }] };

  const orClauses: Prisma.CalendarEventWhereInput[] = [
    { scope: CalendarEventScope.PERSONAL, ownerId: actor.userId },
    { scope: CalendarEventScope.CENTER, ...centerFilter },
  ];

  if (subjectIds === 'ALL') {
    orClauses.push({ scope: CalendarEventScope.SUBJECT });
  } else if (subjectIds.length > 0) {
    orClauses.push({ scope: CalendarEventScope.SUBJECT, subjectId: { in: subjectIds } });
  }

  const events = await prisma.calendarEvent.findMany({
    where: { AND: [dateFilter, { OR: orClauses }] },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { startsAt: 'asc' },
  });

  return events;
}
