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

// ACTUALIZAR TAREA
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
      dueDate: setEndOfDay(dueDate), // Usamos el helper
    };

    // 👇 CORRECCIÓN: Usamos attachmentUrl y guardamos SOLO el nombre del archivo
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

// CALIFICAR TAREA
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

// OBTENER TAREAS (Visibilidad Estudiante Corregida)
export const getAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const role = (req as any).user?.role; 

    if (!userId) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    let whereCondition: any = {};

    if (role === RoleName.STUDENT) {
      // 1. Buscar cursos inscritos
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: userId },
        select: { courseId: true }
      });

      const courseIds = enrollments.map(e => e.courseId);

      // 2. Buscar tareas individuales O grupales
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

    const assignments = await prisma.assignment.findMany({
      where: whereCondition,
      include: {
        subject: { select: { name: true } },
        student: { select: { name: true, email: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo tareas' });
  }
};

// CREAR TAREA
export const createAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, dueDate, courseId, subjectId } = req.body; 
    
    const file = (req as any).file; 
    
    // 👇 CORRECCIÓN IMPORTANTE:
    // 1. Usamos el nombre 'attachmentUrl' en lugar de 'fileUrl'
    // 2. Guardamos SOLO el nombre del archivo (file.filename), NO la ruta completa (/uploads/...)
    //    El Frontend ya sabe agregarle /uploads/ al mostrarlo.
    const attachmentUrl = file ? file.filename : null;

    const course = await prisma.course.findUnique({ where: { id: Number(courseId) } });

    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' });
      return;
    }

    if (course.teacherId !== userId) {
      res.status(403).json({ message: 'No tienes permiso para crear tareas en este curso' });
      return;
    }

    const existingDuplicate = await prisma.assignment.findFirst({
      where: {
        title: title,
        courseId: Number(courseId)
      }
    });

    if (existingDuplicate) {
      res.status(400).json({ message: `Ya existe una tarea llamada "${title}" en este curso.` });
      return;
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        dueDate: setEndOfDay(dueDate),
        courseId: Number(courseId),
        subjectId: Number(subjectId),
        creatorId: userId,
        status: 'PENDING',
        attachmentUrl: attachmentUrl // 👈 Guardamos en la columna correcta
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
};

// ENTREGAR TAREA (Validación estricta de fecha)
export const submitAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = (req as any).file;
    const { comment } = req.body;

    // 1. Validar archivo
    if (!file) {
      res.status(400).json({ message: 'Debes subir un archivo válido (PDF, Word, Imagen).' });
      return;
    }

    // 2. Buscar tarea
    const assignment = await prisma.assignment.findUnique({ where: { id: Number(id) } });

    if (!assignment) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    // 3. VALIDACIÓN DE FECHA
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    
    if (now > dueDate) {
        res.status(403).json({ message: 'El tiempo de entrega ha finalizado. La tarea está vencida.' });
        return;
    }

    // 4. Guardar entrega
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

// ELIMINAR TAREA
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