import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { assertSameCenter, HttpError } from '../utils/tenant';
import { getVisibleAssignmentsForStudent } from '../services/assignment.service';

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
// 3. CALIFICAR ENTREGA
// -----------------------------------------------------
// v2.1: 'id' ahora es el ID de la Submission (la entrega de UN alumno), no
// el de la tarea. Antes tarea==entrega en el mismo modelo, así que esta ruta
// seguía funcionando igual (ver assignment.routes.ts, el path no cambió).
export const gradeSubmission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { grade, feedback } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    const submission = await prisma.submission.findUnique({
      where: { id: Number(id) },
      include: { assignment: { include: { subject: true } } },
    });

    if (!submission) {
      res.status(404).json({ message: 'Entrega no encontrada' });
      return;
    }

    assertSameCenter(authReq, submission.assignment.subject.educationalCenterId);

    if (submission.assignment.creatorId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para calificar esta tarea' });
      return;
    }

    const numericGrade = Number(grade);
    if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 100) {
       res.status(400).json({ message: 'La calificación debe ser un número entre 0 y 100.' });
       return;
    }

    const updatedSubmission = await prisma.submission.update({
      where: { id: Number(id) },
      data: {
        status: 'GRADED',
        grade: numericGrade,
        feedback: feedback || '',
        gradedAt: new Date(),
      },
    });

    res.json({ message: 'Calificación guardada', submission: updatedSubmission });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
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

    // v2.1: el alumno ve cada tarea fusionada con el estado de SU PROPIA
    // entrega (getVisibleAssignmentsForStudent), en vez de filtrar
    // Assignment.studentId directamente — ver assignment.service.ts.
    if (role === RoleName.STUDENT) {
      let visible = await getVisibleAssignmentsForStudent(userId);
      if (subjectId) {
        visible = visible.filter((a) => a.subjectId === Number(subjectId));
      }
      res.json(visible);
      return;
    }

    let whereCondition: any = {};

    if (role === RoleName.TEACHER) {
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
// 6. OBTENER ENTREGAS
// -----------------------------------------------------
// v2.1: ahora consulta la tabla Submission real — una fila por alumno que
// entregó, en vez de simular una única entrega a partir de la propia tarea
// (lo que antes limitaba a un solo alumno por tarea compartida, ver
// CODE_REVIEW.md 10.1).
export const getSubmissionsByAssignment = async (req: Request, res: Response): Promise<void> => {
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

        const submissions = await prisma.submission.findMany({
            where: { assignmentId: Number(id) },
            include: { student: { select: { name: true, email: true } } },
            orderBy: { submittedAt: 'desc' },
        });

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

    // Si la tarea fue asignada individualmente a OTRO alumno específico, esta
    // no es tuya — no corresponde que la entregues (distinto de "ya la
    // entregó otro", ver más abajo: esto es "nunca fue para ti").
    if (assignment.studentId != null && assignment.studentId !== studentId) {
      res.status(403).json({ message: 'Esta tarea fue asignada a otro estudiante.' });
      return;
    }

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

    // v2.1 (CODE_REVIEW.md 10.1, resuelto): la entrega vive en su propia fila
    // (Submission), una por alumno. Ya no existe el límite de "solo el
    // primero que entrega se queda con la tarea compartida" — cada alumno
    // inscrito tiene su propia entrega independiente. Volver a entregar
    // (upsert) limpia la nota/feedback anteriores, igual que antes.
    const submission = await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: Number(id), studentId } },
      create: {
        assignmentId: Number(id),
        studentId,
        status: 'SUBMITTED',
        submissionUrl: file.filename,
        submissionComment: comment || null,
      },
      update: {
        status: 'SUBMITTED',
        submissionUrl: file.filename,
        submissionComment: comment || null,
        grade: null,
        feedback: null,
        gradedAt: null,
        submittedAt: new Date(),
      },
    });

    res.json({ message: 'Tarea entregada con éxito 🚀', submission });
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