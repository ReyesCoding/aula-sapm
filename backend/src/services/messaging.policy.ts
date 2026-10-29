import { RoleName, EnrollmentStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { HttpError } from '../utils/tenant';

/**
 * Política de mensajería centralizada (Bloque 1, v2.0).
 * Toda regla de "quién puede escribirle a quién" vive en este archivo:
 * un único lugar para auditar y extender cuando se agreguen roles o casos
 * nuevos (Open/Closed Principle) en vez de esparcir `if (role === ...)`
 * en cada controlador.
 *
 * Regla de seguridad por defecto (confirmada con el equipo, sept. 2026):
 * SIN mensajería estudiante-a-estudiante en esta fase.
 */

export interface Actor {
  userId: number;
  role: RoleName;
  educationalCenterId: number | null;
}

/** IDs de usuarios con los que `actor` puede iniciar o continuar una conversación. */
export async function getAllowedContactIds(actor: Actor): Promise<number[]> {
  if (actor.role === RoleName.ADMIN) {
    // Admin de plataforma: soporte/operación, puede contactar a cualquiera.
    const all = await prisma.user.findMany({
      where: { isActive: true, id: { not: actor.userId } },
      select: { id: true },
    });
    return all.map((u) => u.id);
  }

  const centerId = actor.educationalCenterId;
  if (centerId == null) {
    throw new HttpError(403, 'Tu usuario no tiene un centro educativo asignado');
  }

  if (actor.role === RoleName.CENTRO) {
    // Admin de centro: cualquiera dentro de su propio centro.
    const users = await prisma.user.findMany({
      where: { educationalCenterId: centerId, isActive: true, id: { not: actor.userId } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (actor.role === RoleName.TEACHER) {
    const subjects = await prisma.subject.findMany({
      where: { teacherId: actor.userId, educationalCenterId: centerId },
      select: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: { studentId: true },
        },
      },
    });
    const studentIds = Array.from(new Set(subjects.flatMap((s) => s.enrollments.map((e) => e.studentId))));

    const parentLinks = studentIds.length
      ? await prisma.parentChild.findMany({ where: { childId: { in: studentIds } }, select: { parentId: true } })
      : [];
    const parentIds = parentLinks.map((p) => p.parentId);

    const staff = await prisma.user.findMany({
      where: {
        educationalCenterId: centerId,
        isActive: true,
        role: { in: [RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN] },
        id: { not: actor.userId },
      },
      select: { id: true },
    });

    return Array.from(new Set([...studentIds, ...parentIds, ...staff.map((s) => s.id)]));
  }

  if (actor.role === RoleName.STUDENT) {
    // Maestros de sus materias inscritas (ACTIVE) + Centro/Admin de su centro (soporte).
    // Deliberadamente NO incluye a otros estudiantes.
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: actor.userId, status: EnrollmentStatus.ACTIVE },
      select: { subject: { select: { teacherId: true } } },
    });
    const teacherIds = Array.from(new Set(enrollments.map((e) => e.subject.teacherId)));

    const staff = await prisma.user.findMany({
      where: { educationalCenterId: centerId, isActive: true, role: { in: [RoleName.CENTRO, RoleName.ADMIN] } },
      select: { id: true },
    });

    return Array.from(new Set([...teacherIds, ...staff.map((s) => s.id)]));
  }

  if (actor.role === RoleName.PARENT) {
    // Maestros de las materias de sus hijos + Centro/Admin (soporte).
    // Deliberadamente NO incluye al propio hijo ni a otros estudiantes/padres.
    const children = await prisma.parentChild.findMany({
      where: { parentId: actor.userId },
      select: { childId: true },
    });
    const childIds = children.map((c) => c.childId);

    const enrollments = childIds.length
      ? await prisma.enrollment.findMany({
          where: { studentId: { in: childIds }, status: EnrollmentStatus.ACTIVE },
          select: { subject: { select: { teacherId: true } } },
        })
      : [];
    const teacherIds = Array.from(new Set(enrollments.map((e) => e.subject.teacherId)));

    const staff = await prisma.user.findMany({
      where: { educationalCenterId: centerId, isActive: true, role: { in: [RoleName.CENTRO, RoleName.ADMIN] } },
      select: { id: true },
    });

    return Array.from(new Set([...teacherIds, ...staff.map((s) => s.id)]));
  }

  return [];
}

/** Solo estos roles pueden crear conversaciones GROUP o ANNOUNCEMENT (no DIRECT). */
export function canCreateGroupOrAnnouncement(role: RoleName): boolean {
  return role === RoleName.ADMIN || role === RoleName.CENTRO || role === RoleName.TEACHER;
}

/** En una conversación ANNOUNCEMENT, solo el creador puede escribir mensajes nuevos. */
export function canPostInAnnouncement(conversationCreatedById: number, senderId: number): boolean {
  return conversationCreatedById === senderId;
}


/**
 * Determina el educationalCenterId de una conversación a partir de sus
 * participantes: si todos los que tienen centro comparten el mismo, se usa
 * ese; si hay más de un centro distinto (o ninguno, ej. ADMIN <-> ADMIN),
 * la conversación queda sin centro único (null) — es un hilo "de plataforma".
 * El control de acceso real sigue siendo "eres participante", no el centro.
 */
export async function resolveConversationCenter(userIds: number[]): Promise<number | null> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { educationalCenterId: true },
  });
  const centers = new Set(users.map((u) => u.educationalCenterId).filter((c): c is number => c != null));
  return centers.size === 1 ? Array.from(centers)[0] : null;
}
