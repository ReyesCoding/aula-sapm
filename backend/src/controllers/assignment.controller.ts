import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { assertSameCenter, HttpError } from '../utils/tenant';

// Helper de fechas
const setEndOfDay = (dateString: string) => {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
};

// -----------------------------------------------------
// 1. CREAR TAREA
// -----------------------------------------------------
export const createAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    // Esta ruta está detrás de authenticateToken (ver assignment.routes.ts), user siempre existe aquí
    const userId = authReq.user!.userId;
    const role = authReq.user!.role;
    const { title, description, subjectId, dueDate } = req.body;
    const file = (req as any).file; // Archivo adjunto por el profesor

    if (!title || !subjectId || !dueDate) {
      res.status(400).json({ message: 'Faltan campos obligatorios.' });
      return;
    }

    // v2.0: la tarea debe pertenecer a una materia del propio profesor y de su centro
    const subject = await prisma.subject.findUnique({ where: { id: Number(subjectId) } });
    if (!subject) {
      res.status(404).json({ message: 'Materia no encontrada' });
      return;
    }
    if (role === RoleName.TEACHER && subject.teacherId !== userId) {
      res.status(403).json({ message: 'No eres el profesor de esta materia' });
      return;
    }
    assertSameCenter(authReq, subject.educationalCenterId);

    const newAssignment = await prisma.assignment.create({
      data: {
        title,
        description: description || '',
        subjectId: Number(subjectId),
        creatorId: userId,
        dueDate: new Date(dueDate),
        attachmentUrl: file ? file.filename : null, // ✅ Guardamos el archivo del profesor
      },
    });

    res.status(201).json(newAssignment);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error al crear la tarea' });
  }
};

// -----------------------------------------------------
// 2. ACTUALIZAR TAREA (EDITAR)
// -----------------------------------------------------
export const updateAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    const file = (req as any).file;

    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) } });

    if (!assignment) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    if (assignment.creatorId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para editar esta tarea' });
      return;
    }

    const updateData: any = {
      title,
      description,
      dueDate: new Date(dueDate),
    };

    // Solo actualizamos el archivo si subieron uno nuevo
    if (file) {
      updateData.attachmentUrl = file.filename;
    }

    const updated = await prisma.assignment.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.json({ message: 'Tarea actualizada', assignment: updated });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error actualizando tarea' });
  }
};

// -----------------------------------------------------
// 3. CALIFICAR TAREA
// -----------------------------------------------------
export const gradeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Aquí 'id' es el ID de la tarea/entrega
    const { grade, feedback } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) } });

    if (!assignment) {
      res.status(404).json({ message: 'Entrega no encontrada' });
      return;
    }

    if (assignment.creatorId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para calificar esta tarea' });
      return;
    }

    const numericGrade = Number(grade);
    if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 100) {
       res.status(400).json({ message: 'La calificación debe ser un número entre 0 y 100.' });
       return;
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id: Number(id) },
      data: {
        status: 'GRADED',
        grade: numericGrade,
        feedback: feedback || ''
      },
    });

    res.json({ message: 'Calificación guardada', assignment: updatedAssignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al calificar' });
  }
};

// -----------------------------------------------------
// 4. OBTENER TAREAS (LISTADO)
// -----------------------------------------------------
export const getAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const role = authReq.user?.role;
    const { subjectId } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    let whereCondition: any = {};

    if (role === RoleName.STUDENT) {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: userId },
        select: { subjectId: true }
      });
      const subjectIds = enrollments.map(e => e.subjectId);

      whereCondition = {
        OR: [
          { studentId: userId },       
          { subjectId: { in: subjectIds } }
        ]
      };
    } else if (role === RoleName.TEACHER) {
      whereCondition = { creatorId: userId };
    } else if (role === RoleName.ADMIN) {
      whereCondition = {};
    } else {
      res.json([]); 
      return;
    }

    if (subjectId) {
      whereCondition.subjectId = Number(subjectId);
    }

    const assignments = await prisma.assignment.findMany({
      where: whereCondition,
      include: {
        subject: { select: { name: true } },
        student: { select: { name: true, email: true } },
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error obteniendo tareas' });
  }
};

// -----------------------------------------------------
// 5. OBTENER TAREA POR ID
// -----------------------------------------------------
export const getAssignmentById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      const { userId, role } = authReq.user!;

      const assignment = await prisma.assignment.findUnique({
        where: { id: Number(id) },
        include: { subject: true }
      });

      if (!assignment) {
          res.status(404).json({ message: 'Tarea no encontrada' });
          return;
      }

      // 🔒 Hallazgo crítico 3.3a (antes corregido): este endpoint devolvía
      // CUALQUIER tarea de CUALQUIER centro a CUALQUIER usuario autenticado,
      // sin verificar rol, centro ni relación con el recurso (IDOR). Ahora:
      assertSameCenter(authReq, assignment.subject.educationalCenterId);

      if (role === RoleName.TEACHER) {
        if (assignment.creatorId !== userId) {
          res.status(403).json({ message: 'No tienes permiso para ver esta tarea' });
          return;
        }
      } else if (role === RoleName.STUDENT) {
        // Puede verla si es la entrega propia, o si aún nadie la reclamó y está
        // inscrito en la materia (tarea maestra para toda la clase).
        const isOwnSubmission = assignment.studentId === userId;
        let isEnrolled = false;
        if (!isOwnSubmission) {
          const enrollment = await prisma.enrollment.findUnique({
            where: { studentId_subjectId: { studentId: userId, subjectId: assignment.subjectId } }
          });
          isEnrolled = !!enrollment;
        }
        if (!isOwnSubmission && !(assignment.studentId == null && isEnrolled)) {
          res.status(403).json({ message: 'No tienes permiso para ver esta tarea' });
          return;
        }
      } else if (role === RoleName.PARENT) {
        if (assignment.studentId == null) {
          res.status(403).json({ message: 'No tienes permiso para ver esta tarea' });
          return;
        }
        const link = await prisma.parentChild.findUnique({
          where: { parentId_childId: { parentId: userId, childId: assignment.studentId } }
        });
        if (!link) {
          res.status(403).json({ message: 'Ese estudiante no es uno de tus hijos/as vinculados' });
          return;
        }
      }
      // CENTRO y ADMIN: ya validados por assertSameCenter (CENTRO) / sin restricción (ADMIN).

      res.json(assignment);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ message: 'Error obteniendo tarea' });
    }
};

// -----------------------------------------------------
// 6. OBTENER ENTREGAS (CORREGIDO PARA TU SCHEMA ACTUAL)
// -----------------------------------------------------
export const getSubmissionsByAssignment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const authReq = req as AuthRequest;
        const { userId, role } = authReq.user!;

        // Buscamos la tarea. 
        // ⚠️ NOTA SENIOR: En tu esquema actual (sin tabla Submission), la tarea SE CONVIERTE en la entrega 
        // cuando el estudiante la envía. Por eso devolvemos la tarea misma si tiene status de entrega.
        
        const assignment = await prisma.assignment.findUnique({
             where: { id: Number(id) },
             include: { student: true, subject: true } // Incluimos info del estudiante si existe
        });

        if (!assignment) {
            res.status(404).json({ message: 'Tarea no encontrada' });
            return;
        }

        // 🔒 Hallazgo crítico 3.3b (antes corregido): este endpoint devolvía las
        // entregas (incluyendo datos del estudiante) de CUALQUIER tarea a
        // CUALQUIER usuario autenticado, sin ninguna verificación (IDOR). Solo
        // el profesor creador, CENTRO del mismo centro o ADMIN pueden verlas:
        // es información sensible de calificación de un alumno, no algo que
        // un STUDENT o PARENT deba consultar por este endpoint (ellos ya tienen
        // su propia vista vía getAssignmentById/getAssignments).
        assertSameCenter(authReq, assignment.subject.educationalCenterId);
        if (role === RoleName.TEACHER && assignment.creatorId !== userId) {
            res.status(403).json({ message: 'No tienes permiso para ver las entregas de esta tarea' });
            return;
        }
        if (role === RoleName.STUDENT || role === RoleName.PARENT) {
            res.status(403).json({ message: 'No tienes permiso para ver las entregas de esta tarea' });
            return;
        }

        const submissions = [];

        // Si la tarea tiene status de enviada o calificada, la contamos como entrega
        if (assignment && (assignment.status === 'SUBMITTED' || assignment.status === 'GRADED')) {
             submissions.push({
                 id: assignment.id,
                 // Si student es null (tarea maestra), mostramos un placeholder o el creador (no ideal, pero evita crash)
                 student: assignment.student || { name: 'Estudiante (Sin Asignar)', email: 'N/A' },
                 status: assignment.status,
                 grade: assignment.grade,
                 submissionUrl: assignment.submissionUrl,
                 submittedAt: assignment.updatedAt,
                 feedback: assignment.feedback
             });
        }

        res.json(submissions);
    } catch (error) {
       if (error instanceof HttpError) {
         res.status(error.statusCode).json({ message: error.message });
         return;
       }
       console.error(error);
       res.status(500).json({ message: 'Error obteniendo entregas' });
    }
};

// -----------------------------------------------------
// 7. ENTREGAR TAREA
// -----------------------------------------------------
export const submitAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = (req as any).file;
    const { comment } = req.body;
    const authReq = req as AuthRequest;
    const studentId = authReq.user!.userId; // Obtenemos el ID del alumno

    if (!file) {
      res.status(400).json({ message: 'Debes subir un archivo válido.' });
      return;
    }

    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) }, include: { subject: true } });

    if (!assignment) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    // v2.0: no se puede entregar una tarea de otro centro
    assertSameCenter(authReq, assignment.subject.educationalCenterId);

    // 🔒 Bug funcional 4.2 (antes corregido): no se verificaba inscripción -
    // cualquier STUDENT del mismo centro podía entregar una tarea de una
    // materia en la que nunca se inscribió.
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_subjectId: { studentId, subjectId: assignment.subjectId } }
    });
    if (!enrollment) {
      res.status(403).json({ message: 'No estás inscrito en la materia de esta tarea' });
      return;
    }

    // ⚠️ LIMITACIÓN DE MODELO DE DATOS (ver CODE_REVIEW.md, hallazgo nuevo 3.5):
    // Assignment no tiene una tabla Submission propia — el registro de la
    // "entrega" vive en la MISMA fila que la tarea maestra (studentId/status/
    // grade sobre Assignment). Eso significa que una tarea compartida por
    // varios alumnos de una materia solo puede ser "reclamada" por el primero
    // que la entrega; evitamos aquí que un segundo alumno pueda robar/
    // sobrescribir la entrega de otro ya reclamada.
    if (assignment.studentId != null && assignment.studentId !== studentId) {
      res.status(409).json({
        message: 'Esta tarea ya fue entregada por otro estudiante. El modelo de datos actual no soporta múltiples entregas independientes para una misma tarea compartida (ver CODE_REVIEW.md).'
      });
      return;
    }

    // Bug funcional 4.1 (antes corregido): si la tarea ya había sido
    // calificada y el alumno vuelve a entregar, la calificación/feedback
    // anteriores quedaban "pegados" mostrando un estado inconsistente
    // (SUBMITTED pero con grade/feedback de una entrega previa). Los
    // limpiamos explícitamente en cada nueva entrega.
    const updatedAssignment = await prisma.assignment.update({
      where: { id: Number(id) },
      data: {
        status: 'SUBMITTED',
        submissionUrl: file.filename,
        submissionComment: comment || null,
        studentId: studentId, // ✅ Vinculamos al estudiante que entregó
        grade: null,
        feedback: null,
      },
    });

    res.json({ message: 'Tarea entregada con éxito 🚀', assignment: updatedAssignment });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error interno al entregar la tarea' });
  }
};

// -----------------------------------------------------
// 8. ELIMINAR TAREA
// -----------------------------------------------------
export const deleteAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) } });

    if (!assignment) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    if (assignment.creatorId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para borrar esta tarea' });
      return;
    }

    await prisma.assignment.delete({ where: { id: Number(id) } });
    res.json({ message: 'Tarea eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar tarea' });
  }
};