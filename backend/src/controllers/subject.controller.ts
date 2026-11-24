import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { EnrollmentStatus, RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { centerWhere } from '../utils/tenant';

export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const actor = authReq.user!;

    // v3.1 (hallazgo nuevo, fuera del reporte original de Bryan): este
    // endpoint alimenta "Mis Materias" en AcademicDashboard.tsx para
    // Estudiante y Padre/Madre, pero antes solo filtraba por CENTRO
    // (centerWhere) — cualquier estudiante veía TODAS las materias de su
    // centro como si estuviera inscrito en todas ellas, no solo en las
    // suyas, y un padre/madre veía lo mismo en vez de ver únicamente las
    // materias de sus hijos. Para Profesor, el filtro por "mis materias"
    // vivía solo en el frontend (AcademicDashboard.tsx filtraba
    // client-side) — cualquier profesor podía igual pedirle a la API las
    // materias de otros profesores de su centro. Ahora cada rol recibe
    // exactamente lo que le corresponde ver; Centro/Admin (que gestionan,
    // no "cursan" materias) siguen viendo todas las de su alcance.
    let where: Record<string, unknown> = { ...centerWhere(authReq) };

    if (actor.role === RoleName.TEACHER) {
      where = { ...where, teacherId: actor.userId };
    } else if (actor.role === RoleName.STUDENT) {
      where = {
        ...where,
        enrollments: { some: { studentId: actor.userId, status: EnrollmentStatus.ACTIVE } },
      };
    } else if (actor.role === RoleName.PARENT) {
      const links = await prisma.parentChild.findMany({ where: { parentId: actor.userId }, select: { childId: true } });
      let childIds = links.map((l) => l.childId);

      // Si el padre/madre tiene 2+ hijos y el frontend pide uno en
      // concreto (selector de hijo — ver AcademicDashboard.tsx), se
      // restringe a ese hijo; si no, se muestran las materias de TODOS
      // sus hijos juntas (comportamiento previo, sigue siendo válido
      // cuando solo hay un hijo vinculado).
      const { childId: requestedChildId } = req.query as { childId?: string };
      if (requestedChildId) {
        const requested = Number(requestedChildId);
        if (!childIds.includes(requested)) {
          res.status(403).json({ message: 'Ese estudiante no está vinculado a tu cuenta.' });
          return;
        }
        childIds = [requested];
      }

      where = {
        ...where,
        enrollments: { some: { studentId: { in: childIds }, status: EnrollmentStatus.ACTIVE } },
      };
    }
    // CENTRO/ADMIN: sin filtro adicional — siguen viendo todas las materias
    // de su alcance (centerWhere ya restringe a Centro a las de su centro).

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true, 
        description: true, 
        
        teacher: {
            select: { name: true, id: true }
        },
        
        _count: {
          select: { 
            assignments: true, 
            exams: true,
            enrollments: true 
          }
        }
      }
    });
    res.json(subjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error obteniendo materias' });
  }
};

// 👇 Unirse a una materia mediante Código
export const joinSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    const { code } = req.body;

    if (!code) { res.status(400).json({ message: 'Código requerido.' }); return; }

    const subject = await prisma.subject.findFirst({ where: { code } });
    if (!subject) { res.status(404).json({ message: 'Código inválido.' }); return; }

    const existing = await prisma.enrollment.findUnique({
        where: { studentId_subjectId: { studentId: userId, subjectId: subject.id } }
    });

    if (existing) {
         if (existing.status === 'PENDING') {
             res.status(400).json({ message: 'Ya enviaste solicitud. Espera a que el profesor te acepte.' });
             return;
         }
         res.status(400).json({ message: 'Ya estás inscrito en esta materia.' });
         return;
    }

    await prisma.enrollment.create({
        data: {
            studentId: userId,
            subjectId: subject.id,
            status: EnrollmentStatus.PENDING // 👈 AHORA ES PENDIENTE
        }
    });

    // Mensaje claro para el usuario
    res.json({ message: `Solicitud enviada a ${subject.name}. El profesor debe aceptarte.` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al unirse.' });
  }
};

// 👇 NUEVA FUNCIÓN: APROBAR/RECHAZAR ALUMNOS (Para el Profesor)
export const manageEnrollment = async (req: Request, res: Response): Promise<void> => {
    try {
        const teacherId = (req as AuthRequest).user!.userId;
        const { enrollmentId, status } = req.body; // status: 'ACTIVE' o 'REJECTED'

        // 1. Validar que la materia pertenezca a este profesor
        const enrollment = await prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            include: { subject: true }
        });

        if (!enrollment) { res.status(404).json({ message: 'Solicitud no encontrada' }); return; }

        if (enrollment.subject.teacherId !== teacherId) {
            res.status(403).json({ message: 'No tienes permiso para gestionar esta solicitud' });
            return;
        }

        // 2. Actualizar estado
        if (status === 'REJECTED') {
            await prisma.enrollment.delete({ where: { id: enrollmentId } }); // O lo marcas como REJECTED
            res.json({ message: 'Solicitud rechazada' });
        } else {
            await prisma.enrollment.update({
                where: { id: enrollmentId },
                data: { status: EnrollmentStatus.ACTIVE }
            });
            res.json({ message: 'Estudiante aceptado correctamente' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error gestionando solicitud' });
    }
};

export const createSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const actor = authReq.user!;
    const { name, code, description, teacherId: bodyTeacherId, educationalCenterId: bodyCenterId } = req.body as {
      name?: string;
      code?: string;
      description?: string;
      teacherId?: number;
      educationalCenterId?: number;
    };

    if (!name || !code) {
       res.status(400).json({ message: 'Nombre y Código son obligatorios' });
       return;
    }

    // Validar duplicados de código
    const existing = await prisma.subject.findFirst({ where: { code } });
    if (existing) {
        res.status(400).json({ message: 'Ya existe una materia con ese código' });
        return;
    }

    // ¿Quién es el profesor titular?
    // - TEACHER: siempre se asigna a sí mismo (no puede crear una materia para otro).
    // - CENTRO/ADMIN: deben indicar teacherId, y ese usuario debe existir y ser TEACHER.
    let teacherId: number;
    if (actor.role === 'TEACHER') {
      teacherId = actor.userId;
    } else {
      if (!bodyTeacherId) {
        res.status(400).json({ message: 'Debes indicar el profesor titular (teacherId) de la materia' });
        return;
      }
      const teacher = await prisma.user.findUnique({ where: { id: Number(bodyTeacherId) } });
      if (!teacher || teacher.role !== 'TEACHER') {
        res.status(400).json({ message: 'El teacherId indicado no corresponde a un profesor válido' });
        return;
      }
      teacherId = teacher.id;
    }

    // v2.0: ¿a qué centro pertenece la materia?
    // - TEACHER/CENTRO: heredan su propio centro (no pueden crear fuera de él).
    // - ADMIN: no pertenece a ningún centro, así que debe indicarlo en el body.
    let educationalCenterId: number | null;
    if (actor.role === 'ADMIN') {
      if (!bodyCenterId) {
        res.status(400).json({ message: 'Como Admin debes indicar educationalCenterId para la materia' });
        return;
      }
      const center = await prisma.educationalCenter.findUnique({ where: { id: Number(bodyCenterId) } });
      if (!center) {
        res.status(404).json({ message: 'El centro educativo indicado no existe' });
        return;
      }
      educationalCenterId = center.id;
    } else {
      educationalCenterId = actor.educationalCenterId;
      if (educationalCenterId == null) {
        res.status(403).json({ message: 'Tu usuario no tiene un centro educativo asignado' });
        return;
      }
    }

    const newSubject = await prisma.subject.create({
      data: {
        name,
        code,
        description,
        teacherId,
        educationalCenterId
      },
      include: { teacher: { select: { id: true, name: true } } }
    });

    res.status(201).json(newSubject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creando la materia' });
  }
};
// 👇 NUEVO (v3.0): Centro necesitaba poder "asignar materias" a su
// profesorado más allá del momento de creación — reasignar la materia de
// un profesor a otro cuando cambia de puesto, o corregir nombre/
// descripción. Antes no existía ningún endpoint de edición.
export const updateSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const actor = authReq.user!;
    const subjectId = Number(req.params.id);
    const { name, description, teacherId: bodyTeacherId } = req.body as {
      name?: string;
      description?: string;
      teacherId?: number;
    };

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) { res.status(404).json({ message: 'Materia no encontrada' }); return; }

    // TEACHER solo puede editar nombre/descripción de SU PROPIA materia (no
    // reasignarla a otro profesor ni tocar materias ajenas).
    if (actor.role === 'TEACHER') {
      if (subject.teacherId !== actor.userId) {
        res.status(403).json({ message: 'No eres el profesor titular de esta materia' });
        return;
      }
      if (bodyTeacherId !== undefined && Number(bodyTeacherId) !== actor.userId) {
        res.status(403).json({ message: 'No puedes reasignar tu materia a otro profesor' });
        return;
      }
    } else if (actor.role === 'CENTRO' || actor.role === 'ADMIN') {
      // Centro/Admin: la materia debe pertenecer a su centro (Admin pasa siempre).
      if (actor.role === 'CENTRO' && subject.educationalCenterId !== actor.educationalCenterId) {
        res.status(403).json({ message: 'Esta materia pertenece a otro centro' });
        return;
      }
    } else {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }

    let teacherId: number | undefined;
    if (bodyTeacherId !== undefined && actor.role !== 'TEACHER') {
      const teacher = await prisma.user.findUnique({ where: { id: Number(bodyTeacherId) } });
      if (!teacher || teacher.role !== 'TEACHER') {
        res.status(400).json({ message: 'El teacherId indicado no corresponde a un profesor válido' });
        return;
      }
      if (actor.role === 'CENTRO' && teacher.educationalCenterId !== actor.educationalCenterId) {
        res.status(400).json({ message: 'Ese profesor no pertenece a tu centro' });
        return;
      }
      teacherId = teacher.id;
    }

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(teacherId !== undefined && { teacherId }),
      },
      include: { teacher: { select: { id: true, name: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error actualizando la materia' });
  }
};

// 👇 NUEVO (v3.0): borrar una materia (Centro/Admin). Mismo patrón de
// protección por llave foránea que users.controller.ts::deleteUser — si
// tiene tareas/exámenes/inscripciones asociadas, se pide desactivarla en
// vez de borrarla (aquí: simplemente no se permite, no hay campo isActive
// en Subject todavía).
export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const actor = authReq.user!;
    const subjectId = Number(req.params.id);

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) { res.status(404).json({ message: 'Materia no encontrada' }); return; }

    if (actor.role === 'CENTRO' && subject.educationalCenterId !== actor.educationalCenterId) {
      res.status(403).json({ message: 'Esta materia pertenece a otro centro' });
      return;
    }

    await prisma.subject.delete({ where: { id: subjectId } });
    res.json({ message: 'Materia eliminada correctamente' });
  } catch (error) {
    console.error(error);
    if ((error as { code?: string }).code === 'P2003') {
      res.status(400).json({ message: 'No se puede eliminar: la materia tiene tareas, exámenes o inscripciones asociadas.' });
      return;
    }
    res.status(500).json({ message: 'Error eliminando la materia' });
  }
};
