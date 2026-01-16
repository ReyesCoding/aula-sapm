import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';

// 👇 1. HELPERS DE FECHA (Para que no venza a las 00:00)
const setEndOfDay = (dateString: string) => {
  const date = new Date(dateString);
  // Ajustamos a la última hora del día.
  date.setHours(23, 59, 59, 999);
  return date;
};

// -----------------------------------------------------
// 1. CREAR TAREA (RESTITUIDA ✅)
// -----------------------------------------------------
export const createAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, subjectId, dueDate } = req.body;
    const file = (req as any).file;

    // Validaciones básicas
    if (!title || !subjectId || !dueDate) {
      res.status(400).json({ message: 'Faltan campos obligatorios (Título, Materia, Fecha de entrega).' });
      return;
    }

    const newAssignment = await prisma.assignment.create({
      data: {
        title,
        description: description || '',
        subjectId: Number(subjectId),
        creatorId: userId,
        dueDate: setEndOfDay(dueDate), // Usamos tu helper para consistencia
        attachmentUrl: file ? file.filename : null, // Guardamos el archivo si existe
      },
    });

    res.status(201).json(newAssignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear la tarea' });
  }
};

// -----------------------------------------------------
// 2. ACTUALIZAR TAREA (Tu versión ✅)
// -----------------------------------------------------
export const updateAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;
    const userId = (req as any).user?.userId;
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
      dueDate: setEndOfDay(dueDate),
    };

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
    res.status(500).json({ error: 'Error actualizando tarea' });
  }
};

// -----------------------------------------------------
// 3. CALIFICAR TAREA (Tu versión ✅)
// -----------------------------------------------------
export const gradeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { grade, feedback } = req.body;
    const userId = (req as any).user?.userId;

    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) } });

    if (!assignment) {
      res.status(404).json({ message: 'Tarea no encontrada' });
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

    res.json({ message: 'Calificación guardada exitosamente', assignment: updatedAssignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calificar la tarea' });
  }
};

// -----------------------------------------------------
// 4. OBTENER TAREAS (Tu versión con Filtro SubjectId ✅)
// -----------------------------------------------------
export const getAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const role = (req as any).user?.role;
    
    // 👇 Capturamos el filtro de la URL (?subjectId=1)
    const { subjectId } = req.query;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    let whereCondition: any = {};

    // --- LÓGICA DE ROLES ---
    if (role === RoleName.STUDENT) {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: userId },
        select: { courseId: true }
      });
      const courseIds = enrollments.map(e => e.courseId);

      whereCondition = {
        OR: [
          { studentId: userId },       
          { courseId: { in: courseIds } } 
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

    // --- FILTRO POR MATERIA ---
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
    res.status(500).json({ error: 'Error obteniendo tareas' });
  }
};

// -----------------------------------------------------
// 5. ENTREGAR TAREA (Tu versión ✅)
// -----------------------------------------------------
export const submitAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = (req as any).file;
    const { comment } = req.body;

    if (!file) {
      res.status(400).json({ message: 'Debes subir un archivo válido (PDF, Word, Imagen).' });
      return;
    }

    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) } });

    if (!assignment) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    // Validación fecha
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    
    if (now > dueDate) {
        res.status(403).json({ message: 'El tiempo de entrega ha finalizado. La tarea está vencida.' });
        return;
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id: Number(id) },
      data: {
        status: 'SUBMITTED',
        submissionUrl: file.filename,
        submissionComment: comment || null,
      },
    });

    res.json({ message: 'Tarea entregada con éxito 🚀', assignment: updatedAssignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error interno al entregar la tarea' });
  }
};

// -----------------------------------------------------
// 6. ELIMINAR TAREA (Tu versión ✅)
// -----------------------------------------------------
export const deleteAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

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
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
};