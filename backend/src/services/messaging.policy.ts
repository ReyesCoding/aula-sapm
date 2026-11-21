import { RoleName, EnrollmentStatus } from '@prisma/client';
import prisma from '../prisma/client';
import { HttpError } from '../utils/tenant';

/**
 * Política de mensajería centralizada (Bloque 1, v2.0 — reglas de v3.0
 * aplicadas en esta pasada, nov. 2026, a pedido explícito de Bryan: la
 * mensajería debe reflejar la misma cadena de mando que el resto del
 * sistema, no "todos pueden hablar con todos dentro del centro").
 * Toda regla de "quién puede escribirle a quién" vive en este archivo: un
 * único lugar para auditar y extender cuando se agreguen roles o casos
 * nuevos (Open/Closed Principle) en vez de esparcir `if (role === ...)`
 * en cada controlador.
 *
 * Matriz vigente (ver CODE_REVIEW.md sección 10.6 para el razonamiento
 * completo):
 *
 *   ADMIN   <-> CENTRO (de cualquier centro). Admin ya NO habla directo con
 *               Profesor/Estudiante/Padre — ese contacto siempre pasa por
 *               el Centro, que es quien realmente opera cada plantel.
 *   CENTRO  <-> Profesores de su propio centro (gestión de personal),
 *               Padres de su propio centro, Admin (escalamiento). Con
 *               Estudiantes el canal es intencionalmente limitado: no se
 *               ofrece como chat libre en la UI (ver "buzón de sugerencias"
 *               en STUDENT), pero el hilo igual puede existir para que
 *               Centro responda si un estudiante escribe primero.
 *   TEACHER <-> Alumnos de SUS materias activas, Padres de esos alumnos,
 *               otros Profesores de su centro, Centro. Ya NO habla
 *               directo con Admin.
 *   STUDENT <-> Compañeros de clase (comparten al menos una materia activa),
 *               Profesores de sus materias activas, su(s) propio(s) Padre/
 *               Madre vinculado(s), Centro (de forma limitada — en el
 *               frontend este canal se presenta como "Buzón de
 *               Sugerencias", no como chat libre). Sigue sin poder hablar
 *               con Admin, ni con estudiantes de materias donde no coincide.
 *   PARENT  <-> Otros Padres cuyos hijos comparten clase con el suyo, el/
 *               los hijo(s) vinculado(s) a su perfil, Profesores de las
 *               materias de sus hijos, Centro. Sigue sin poder hablar con
 *               Admin.
 */

export interface Actor {
  userId: number;
  role: RoleName;
  educationalCenterId: number | null;
}

async function activeSubjectIdsForStudents(studentIds: number[]): Promise<number[]> {
  if (studentIds.length === 0) return [];
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: { in: studentIds }, status: EnrollmentStatus.ACTIVE },
    select: { subjectId: true },
  });
  return Array.from(new Set(enrollments.map((e) => e.subjectId)));
}

/** IDs de usuarios con los que `actor` puede iniciar o continuar una conversación. */
export async function getAllowedContactIds(actor: Actor): Promise<number[]> {
  if (actor.role === RoleName.ADMIN) {
    // Admin de plataforma: su único canal directo es el staff CENTRO de
    // cada centro (soporte/escalamiento). Ya no enumera ni contacta
    // directamente a profesores, estudiantes ni padres de ningún centro.
    const centros = await prisma.user.findMany({
      where: { isActive: true, role: RoleName.CENTRO, id: { not: actor.userId } },
      select: { id: true },
    });
    return centros.map((u) => u.id);
  }

  const centerId = actor.educationalCenterId;
  if (centerId == null) {
    throw new HttpError(403, 'Tu usuario no tiene un centro educativo asignado');
  }

  if (actor.role === RoleName.CENTRO) {
    // Centro: profesorado y familias de su propio centro (es quien
    // administra al personal y atiende trámites), más Admin (escalamiento).
    const centerUsers = await prisma.user.findMany({
      where: {
        educationalCenterId: centerId,
        isActive: true,
        role: { in: [RoleName.TEACHER, RoleName.PARENT, RoleName.STUDENT] },
        id: { not: actor.userId },
      },
      select: { id: true },
    });
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: RoleName.ADMIN },
      select: { id: true },
    });
    return [...centerUsers.map((u) => u.id), ...admins.map((u) => u.id)];
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

    // Sin ADMIN: un profesor ya no escribe directo a la plataforma, escala
    // a través de Centro (igual que Estudiante/Padre).
    const staff = await prisma.user.findMany({
      where: {
        educationalCenterId: centerId,
        isActive: true,
        role: { in: [RoleName.TEACHER, RoleName.CENTRO] },
        id: { not: actor.userId },
      },
      select: { id: true },
    });

    return Array.from(new Set([...studentIds, ...parentIds, ...staff.map((s) => s.id)]));
  }

  if (actor.role === RoleName.STUDENT) {
    // Compañeros de clase + profesores de sus materias activas + su(s)
    // padre/madre vinculado(s) + Centro (canal limitado, ver UI).
    // Deliberadamente NO incluye a Admin, ni a estudiantes con los que no
    // comparte ninguna materia activa.
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: actor.userId, status: EnrollmentStatus.ACTIVE },
      select: { subjectId: true, subject: { select: { teacherId: true } } },
    });
    const mySubjectIds = enrollments.map((e) => e.subjectId);
    const teacherIds = Array.from(new Set(enrollments.map((e) => e.subject.teacherId)));

    const classmateEnrollments = mySubjectIds.length
      ? await prisma.enrollment.findMany({
          where: { subjectId: { in: mySubjectIds }, status: EnrollmentStatus.ACTIVE, studentId: { not: actor.userId } },
          select: { studentId: true },
        })
      : [];
    const classmateIds = Array.from(new Set(classmateEnrollments.map((e) => e.studentId)));

    const parentLinks = await prisma.parentChild.findMany({
      where: { childId: actor.userId },
      select: { parentId: true },
    });
    const parentIds = parentLinks.map((p) => p.parentId);

    const centro = await prisma.user.findMany({
      where: { educationalCenterId: centerId, isActive: true, role: RoleName.CENTRO },
      select: { id: true },
    });

    return Array.from(new Set([...classmateIds, ...teacherIds, ...parentIds, ...centro.map((c) => c.id)]));
  }

  if (actor.role === RoleName.PARENT) {
    // Su(s) propio(s) hijo(s) vinculado(s) + profesores de las materias de
    // esos hijos + otros padres cuyos hijos comparten clase con el suyo +
    // Centro. Deliberadamente NO incluye Admin.
    const children = await prisma.parentChild.findMany({
      where: { parentId: actor.userId },
      select: { childId: true },
    });
    const childIds = children.map((c) => c.childId);

    const enrollments = childIds.length
      ? await prisma.enrollment.findMany({
          where: { studentId: { in: childIds }, status: EnrollmentStatus.ACTIVE },
          select: { subjectId: true, subject: { select: { teacherId: true } } },
        })
      : [];
    const teacherIds = Array.from(new Set(enrollments.map((e) => e.subject.teacherId)));
    const sharedSubjectIds = Array.from(new Set(enrollments.map((e) => e.subjectId)));

    const classmateEnrollments = sharedSubjectIds.length
      ? await prisma.enrollment.findMany({
          where: {
            subjectId: { in: sharedSubjectIds },
            status: EnrollmentStatus.ACTIVE,
            studentId: { notIn: childIds },
          },
          select: { studentId: true },
        })
      : [];
    const classmateIds = Array.from(new Set(classmateEnrollments.map((e) => e.studentId)));

    const otherParentLinks = classmateIds.length
      ? await prisma.parentChild.findMany({
          where: { childId: { in: classmateIds }, parentId: { not: actor.userId } },
          select: { parentId: true },
        })
      : [];
    const otherParentIds = Array.from(new Set(otherParentLinks.map((p) => p.parentId)));

    const centro = await prisma.user.findMany({
      where: { educationalCenterId: centerId, isActive: true, role: RoleName.CENTRO },
      select: { id: true },
    });

    return Array.from(new Set([...childIds, ...teacherIds, ...otherParentIds, ...centro.map((c) => c.id)]));
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
