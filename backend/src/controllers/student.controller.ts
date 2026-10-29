import { Request, Response } from 'express';
import prisma from '../prisma/client'; // 👈 Asegúrate de importar tu cliente prisma configurado

// Helper para convertir a entero
const toInt = (v: any): number | null => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

// 1. Obtener Rendimiento
export const getMyPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = (req as any).user?.userId;

    if (!studentId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    // Buscamos materias donde el estudiante está inscrito
    // Y dentro de esas materias, las asignaciones (Assignments) asignadas a él
    // Nota: el schema real no tiene un modelo "Course" ligado a Enrollment,
    // la relación correcta es Enrollment -> Subject -> Assignment[].
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      include: {
        subject: {
          include: {
            assignments: {
              where: { studentId } // Solo mis tareas asignadas
            }
          }
        }
      }
    });

    const resumen = enrollments.map((enrollment) => {
      const subject = enrollment.subject;
      const total = subject.assignments.length;
      // Consideramos completada si está enviada o calificada
      const completadas = subject.assignments.filter((t) =>
        t.status === 'SUBMITTED' || t.status === 'GRADED'
      ).length;

      const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0;

      return {
        materia: subject.name,
        tareas_totales: total,
        completadas,
        progreso: `${progreso}%`,
      };
    });

    res.json({ resumen });
  } catch (error) {
    console.error("Error al obtener rendimiento:", error);
    res.status(500).json({ message: "Error al obtener rendimiento", error });
  }
};

// 2. Obtener Perfil
export const getStudentProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ message: 'Usuario no autenticado' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            educationalCenterId: true,
            createdAt: true
        }
      });

      if (!user) {
        res.status(404).json({ message: 'Estudiante no encontrado' });
        return;
      }

      res.json({ student: user });
    } catch (error) {
      console.error("Error al cargar perfil:", error);
      res.status(500).json({ message: "Error al obtener perfil", error });
    }
  };

// 3. Obtener Tareas Próximas (Upcoming)
export const getMyUpcoming = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = (req as any).user;
    if (!auth) {
        res.status(401).json({ message: 'No autenticado' });
        return;
    }

    // days: default 14, min 1, max 60
    const parsed = toInt(req.query.days);
    const days = parsed && parsed >= 1 && parsed <= 60 ? parsed : 14;

    const now = new Date();
    const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Buscamos Assignments (antes Tasks)
    const assignments = await prisma.assignment.findMany({
      where: {
        studentId: auth.userId,
        status: 'PENDING', // Solo pendientes
        dueDate: { gte: now, lte: to }, // Usamos dueDate en vez de deadline
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });

    res.json({
      window: { from: now.toISOString(), to: to.toISOString(), days },
      upcoming: assignments.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        deadline: t.dueDate.toISOString(), // Mantenemos nombre 'deadline' para frontend si quieres, o cambia a dueDate
        subject: t.subject ? { id: t.subject.id, name: t.subject.name } : null,
      })),
    });
  } catch (error: any) {
    console.error('Error getMyUpcoming (student):', error);
    res.status(500).json({ message: 'Error interno', error: error?.message });
  }
};
