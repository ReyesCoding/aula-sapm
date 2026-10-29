import { RoleName, EnrollmentStatus, Subject } from '@prisma/client';
import prisma from '../prisma/client';
import { HttpError } from '../utils/tenant';

/**
 * Política de foros (Bloque 2, v2.0): quién ve/participa/modera el foro de
 * una materia. Centralizado aquí por el mismo motivo que messaging.policy.ts
 * — un solo lugar para auditar y extender.
 */

export interface ForumActor {
  userId: number;
  role: RoleName;
  educationalCenterId: number | null;
}

export async function loadSubjectOrThrow(subjectId: number): Promise<Subject> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new HttpError(404, 'Materia no encontrada');
  return subject;
}

/** ¿Puede ver/participar en el foro de esta materia? Lanza 403 si no. */
export async function assertCanAccessForum(actor: ForumActor, subject: Subject): Promise<void> {
  if (actor.role === RoleName.ADMIN) return;

  if (actor.role === RoleName.CENTRO) {
    if (subject.educationalCenterId !== actor.educationalCenterId) {
      throw new HttpError(403, 'Esta materia pertenece a otro centro');
    }
    return;
  }

  if (actor.role === RoleName.TEACHER) {
    if (subject.teacherId === actor.userId) return;
    throw new HttpError(403, 'No eres el profesor de esta materia');
  }

  if (actor.role === RoleName.STUDENT) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_subjectId: { studentId: actor.userId, subjectId: subject.id } },
    });
    if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new HttpError(403, 'No estás inscrito en esta materia');
    }
    return;
  }

  // PARENT y otros roles: sin acceso al foro (no está en el alcance del Bloque 2)
  throw new HttpError(403, 'Tu rol no tiene acceso a los foros');
}

/** ¿Puede moderar esta materia (crear/fijar/cerrar temas, borrar cualquier post)? */
export function canModerateSubject(actor: ForumActor, subject: Subject): boolean {
  if (actor.role === RoleName.ADMIN) return true;
  if (actor.role === RoleName.CENTRO) return subject.educationalCenterId === actor.educationalCenterId;
  if (actor.role === RoleName.TEACHER) return subject.teacherId === actor.userId;
  return false;
}
