import { RoleName, EnrollmentStatus, Subject } from '@prisma/client';
import prisma from '../prisma/client';
import { HttpError } from '../utils/tenant';

/**
 * Política de calificaciones (Bloque 3, v2.0): quién puede calificar una
 * materia y quién puede ver las calificaciones de un alumno dado.
 * Centralizado aquí por el mismo motivo que messaging.policy.ts y
 * forum.policy.ts — un solo lugar para auditar y extender.
 */

export interface GradeActor {
  userId: number;
  role: RoleName;
  educationalCenterId: number | null;
}

/** ¿Puede crear/editar/borrar evaluaciones manuales en esta materia? */
export function canGradeSubject(actor: GradeActor, subject: Subject): boolean {
  if (actor.role === RoleName.ADMIN) return true;
  if (actor.role === RoleName.CENTRO) return subject.educationalCenterId === actor.educationalCenterId;
  if (actor.role === RoleName.TEACHER) return subject.teacherId === actor.userId;
  return false;
}

/**
 * ¿Puede `actor` ver las calificaciones de `studentId`? Lanza 403 si no.
 * - ADMIN: siempre.
 * - STUDENT: solo las propias.
 * - PARENT: solo si `studentId` es un hijo vinculado (ParentChild).
 * - CENTRO: solo si el alumno pertenece a su mismo centro.
 * - TEACHER: solo si comparte al menos una materia con inscripción ACTIVE.
 */
export async function assertCanViewStudentGrades(actor: GradeActor, studentId: number): Promise<void> {
  if (actor.role === RoleName.ADMIN) return;

  if (actor.role === RoleName.STUDENT) {
    if (actor.userId !== studentId) {
      throw new HttpError(403, 'Solo puedes ver tus propias calificaciones');
    }
    return;
  }

  if (actor.role === RoleName.PARENT) {
    const link = await prisma.parentChild.findUnique({
      where: { parentId_childId: { parentId: actor.userId, childId: studentId } },
    });
    if (!link) {
      throw new HttpError(403, 'Ese estudiante no es uno de tus hijos/as vinculados');
    }
    return;
  }

  if (actor.role === RoleName.CENTRO) {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { educationalCenterId: true },
    });
    if (!student || student.educationalCenterId !== actor.educationalCenterId) {
      throw new HttpError(403, 'Ese estudiante pertenece a otro centro educativo');
    }
    return;
  }

  if (actor.role === RoleName.TEACHER) {
    const sharedActiveSubject = await prisma.enrollment.findFirst({
      where: {
        studentId,
        status: EnrollmentStatus.ACTIVE,
        subject: { teacherId: actor.userId },
      },
    });
    if (!sharedActiveSubject) {
      throw new HttpError(403, 'No tienes ninguna materia activa en común con este estudiante');
    }
    return;
  }

  throw new HttpError(403, 'Tu rol no tiene acceso a calificaciones');
}
