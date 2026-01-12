import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { getISOWeek } from 'date-fns';
import { requireIntId } from '../utils/assertRole'; // <- ya lo tienes


export const getTasksByWeekForSubject = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.userId;
    const subjectId = parseInt(req.params.id);

    if (!studentId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    // Verificamos que la materia pertenezca al estudiante
    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        students: {
          some: { id: studentId },
        },
      },
    });

    if (!subject) {
      return res.status(403).json({ message: 'No tienes acceso a esta materia' });
    }

    const tasks = await prisma.task.findMany({
      where: {
        subjectId,
        studentId,
      },
      orderBy: {
        deadline: 'asc',
      },
    });

    const grouped: Record<string, any[]> = {};

    tasks.forEach(task => {
      const week = `Semana ${getISOWeek(new Date(task.deadline))}`;

      if (!grouped[week]) grouped[week] = [];

      grouped[week].push({
        id: task.id,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        isCompleted: task.isCompleted,
      });
    });

    res.json({ materia: subject.name, tareasPorSemana: grouped });
  } catch (error) {
    console.error("Error al obtener tareas agrupadas:", error);
    res.status(500).json({ message: "Error al obtener tareas agrupadas", error });
  }
};

// Crear una nueva tarea
export const createTask = async (req: Request, res: Response) => {
    const uid = req.user?.userId; // ✅ ya viene tipado desde el augment global

  try {
    const { title, description, deadline, subjectId } = req.body;

    // Validaciones básicas
    if (!req.user || typeof req.user.userId !== 'number') {
      return res.status(400).json({ message: 'ID del usuario no disponible o inválido' });
    }

    if (!subjectId || typeof subjectId !== 'number') {
      return res.status(400).json({ message: 'ID de materia (subjectId) es requerido' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        deadline,
        studentId: req.user.userId,
        subjectId: subjectId,
      },
    });

    res.status(201).json({ message: 'Tarea creada', task });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    res.status(500).json({ message: 'Error al crear tarea', error });
  }
};

// Obtener tareas de un estudiante autenticado (para /tasks/my-tasks)
export const getMyTasks = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user?.userId; // ← extraído del token

    if (!studentId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const tasks = await prisma.task.findMany({
      where: {
        studentId: studentId, // ← ahora sí se envía correctamente
      },
      orderBy: {
        deadline: 'asc',
      },
    });

    res.json({ tasks });
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    res.status(500).json({ message: "Error al obtener tareas", error });
  }
};

// Obtener tareas de un estudiante por ID (para uso administrativo o debug)
export const getTasksByStudent = async (req: Request, res: Response) => {
  try {
    //const studentId = parseInt(req.params.studentId);
    const studentId = (req as any).user?.userId;

    const tasks = await prisma.task.findMany({
      where: { studentId },
      orderBy: { deadline: 'asc' },
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({ message: 'Error al obtener tareas', error });
  }
};

// Marcar una tarea como completada
export const completeTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) Validación de auth
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    if (user.role !== 'Estudiante') {
      return res.status(403).json({ message: 'Acceso denegado: sólo estudiantes' });
    }

    // 2) Validación del ID (numérico)
    const taskId = requireIntId(req.params.id, 'id');

    // 3) Verificar que la tarea pertenece al estudiante autenticado
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, studentId: true, isCompleted: true },
    });

    if (!task) {
      return res.status(404).json({ message: 'No encontrado', error: 'Tarea no existe' });
    }
    if (task.studentId !== user.userId) {
      return res.status(403).json({ message: 'Acceso denegado', error: 'La tarea no pertenece al estudiante' });
    }

    // 4) Marcar como completada
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { isCompleted: true },
      select: { id: true, isCompleted: true },
    });

    return res.json({
      message: 'Tarea marcada como completada',
      task: updated,
    });
  } catch (err) {
    return next(err); // <-- deja que el error.middleware decida el status (p.ej. 400)
  }
};