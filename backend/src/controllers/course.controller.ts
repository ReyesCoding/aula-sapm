import { Request, Response } from 'express';
// import prisma from '../prisma/client'; // Descomenta cuando uses Course
import { RoleName } from '@prisma/client';

// ⚠️ NOTA DE MIGRACIÓN:
// Como hemos migrado la lógica a 'Subject' (Materias) para la Fase 1, 
// este controlador está temporalmente desactivado para evitar errores de Prisma
// al buscar relaciones que ya no existen en el esquema actual (ej: course.students).

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    // Si el frontend llama a esto por error, devolvemos array vacío para no romper nada.
    // En el futuro, descomenta y ajusta la lógica cuando 'Course' esté activo.
    res.json([]);
    
    /* LÓGICA ANTERIOR (Guardada para referencia futura):
    
    const userId = (req as any).user?.userId;
    const role = (req as any).user?.role;
    let whereCondition = {};

    if (role === RoleName.TEACHER) {
      whereCondition = { teacherId: userId };
    } 
    // ... otros roles ...

    const courses = await prisma.course.findMany({
      where: whereCondition,
      include: {
        subject: true,
        // teacher: ... 
        // _count: { select: { students: true } } // <-- ESTO ROMPÍA PORQUE students NO EXISTE EN COURSE AHORA
      }
    });
    res.json(courses);
    */
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
    try {
        // Placeholder hasta Fase 2
        res.status(501).json({ message: "Funcionalidad de Cursos no activa en esta versión. Usa Materias." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear curso' });
    }
};

export const enrollStudent = async (req: Request, res: Response): Promise<void> => {
    try {
        // Placeholder hasta Fase 2
        res.status(501).json({ message: "Inscripción por Curso no activa. Usa Inscripción por Materia." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al inscribir estudiante' });
    }
};