import { canGradeSubject } from './grades.policy';
import { assertCanAccessForum } from './forum.policy';

/**
 * Política de materiales de materia (Bloque 6, v2.0).
 *
 * Quién puede subir/borrar material de una materia sigue la misma regla que
 * calificar/tomar asistencia/crear eventos de esa materia (profesor dueño, o
 * Centro/Admin) — se reutiliza `canGradeSubject`, igual patrón que
 * `attendance.policy.ts` y `calendar.policy.ts`.
 *
 * Quién puede ver/descargar el material sigue la misma regla que acceder al
 * foro de esa materia (profesor dueño, estudiante inscrito ACTIVE, Centro/
 * Admin — sin PARENT, mismo criterio que el Bloque 2) — se reutiliza
 * `assertCanAccessForum` de `forum.policy.ts`.
 */
export const canManageSubjectMaterials = canGradeSubject;
export const assertCanAccessSubjectMaterials = assertCanAccessForum;
