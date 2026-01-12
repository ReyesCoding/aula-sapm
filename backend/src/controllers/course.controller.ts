import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    let whereCondition = {};

    if (role === RoleName.ADMIN) {
      // Admin ve TODOS los cursos
      whereCondition = {}; 
    } else if (role === RoleName.TEACHER) {
      // Teacher ve los cursos que ÉL imparte
      whereCondition = { teacherId: userId };
    } else if (role === RoleName.STUDENT) {
      // Student ve cursos donde está inscrito
      whereCondition = {
        students: {
          some: {
            studentId: userId
          }
        }
      };
    }

    const courses = await prisma.course.findMany({
      where: whereCondition,
      include: {
        subject: true,
        teacher: { 
          // 👇 AQUÍ ESTABA EL DETALLE: Agregamos 'id: true'
          select: { 
            id: true, // 👈 Importante para validaciones en el frontend
            name: true, 
            email: true 
          }
        },
        _count: {
          select: { students: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cursos' });
  }
};

// ... Asegúrate de mantener aquí abajo el resto de tus funciones (createCourse, enrollStudent, etc.) si las tenías en este archivo.
// Si las tienes separadas o más abajo, no las borres.
export const createCourse = async (req: Request, res: Response): Promise<void> => {
    // ... tu código existente de createCourse
    try {
        const { name, code, description, teacherId, subjectId } = req.body;
    
        const existingCourse = await prisma.course.findUnique({ where: { code } });
        if (existingCourse) {
          res.status(400).json({ message: 'Ya existe un curso con ese código' });
          return;
        }
    
        const course = await prisma.course.create({
          data: {
            name,
            code,
            description,
            teacherId: Number(teacherId),
            subjectId: Number(subjectId)
          }
        });
    
        res.status(201).json(course);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear curso' });
      }
};

export const enrollStudent = async (req: Request, res: Response): Promise<void> => {
    // ... tu código existente de enrollStudent
    try {
        const { courseId, studentId } = req.body;
    
        // 🛡️ LÓGICA DE VALIDACIÓN DE DUPLICADOS
        const existingEnrollment = await prisma.enrollment.findUnique({
          where: {
            studentId_courseId: { 
              studentId: Number(studentId),
              courseId: Number(courseId)
            }
          }
        });
    
        if (existingEnrollment) {
           res.status(400).json({ message: 'El estudiante ya está inscrito en este curso.' });
           return;
        }
    
        const enrollment = await prisma.enrollment.create({
          data: {
            courseId: Number(courseId),
            studentId: Number(studentId),
          },
        });
        res.status(201).json(enrollment);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al inscribir estudiante' });
      }
};