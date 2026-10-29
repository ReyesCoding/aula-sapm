import { RoleName } from '@prisma/client';
import { canGradeSubject } from './grades.policy';

/**
 * Política de calendario (Bloque 5, v2.0).
 */

export interface CalendarActor {
  userId: number;
  role: RoleName;
  educationalCenterId: number | null;
}

/**
 * ¿Puede crear/editar/borrar eventos de tipo SUBJECT en esta materia?
 * Misma regla que calificar/tomar asistencia: profesor dueño, o Centro/Admin.
 * Reutilizado desde grades.policy.ts por el mismo motivo que
 * attendance.policy.ts — una sola fuente de verdad mientras la regla
 * de negocio sea idéntica.
 */
export const canManageSubjectEvents = canGradeSubject;

/** ¿Puede crear/editar/borrar eventos de tipo CENTER? Solo Centro (el suyo) o Admin (cualquiera, o global). */
export function canManageCenterEvents(actor: CalendarActor): boolean {
  return actor.role === RoleName.ADMIN || actor.role === RoleName.CENTRO;
}

/** ¿Puede este Centro administrar un evento CENTER que ya existe con este educationalCenterId? */
export function ownsCenterEvent(actor: CalendarActor, eventCenterId: number | null): boolean {
  if (actor.role === RoleName.ADMIN) return true;
  if (actor.role === RoleName.CENTRO) return eventCenterId === actor.educationalCenterId;
  return false;
}
