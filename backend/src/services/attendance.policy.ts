import { canGradeSubject, assertCanViewStudentGrades } from './grades.policy';

/**
 * Política de asistencia (Bloque 4, v2.0).
 *
 * La regla de "quién puede gestionar" (tomar/editar asistencia de una
 * materia) y "quién puede ver" (consultar la asistencia de un alumno) es
 * exactamente la misma que la de Calificaciones: el profesor dueño de la
 * materia (o Centro/Admin) administra, y la visibilidad sigue el mismo
 * criterio Admin/Student-propio/Parent-vinculado/Centro-mismo-centro/
 * Teacher-con-materia-activa-en-común. En vez de duplicar esa lógica se
 * reutiliza `grades.policy.ts` con nombres propios, para que el controller
 * de asistencia se lea con su propio vocabulario y quede documentado por
 * qué son "la misma regla" (si un día dejan de serlo, basta con separar
 * estas dos líneas en su propia implementación).
 */
export const canManageAttendance = canGradeSubject;
export const assertCanViewStudentAttendance = assertCanViewStudentGrades;
