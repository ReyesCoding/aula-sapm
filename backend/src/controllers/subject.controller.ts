import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { EnrollmentStatus } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { centerWhere } from '../utils/tenant';

export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    // v2.0: cada centro solo ve sus propias materias (ADMIN ve todas)
    const subjects = await prisma.subject.findMany({
      where: { ...centerWhere(req as AuthRequest) },
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
    const userId = (req as any).user?.userId;
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
        // @ts-ignore
        const teacherId = req.user.userId;
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
    // @ts-ignore
    const teacherId = req.user.userId;
    const { name, code, description } = req.body;

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

    // v2.0: la materia hereda el centro del profesor que la crea
    const educationalCenterId = authReq.user?.educationalCenterId ?? null;
    if (educationalCenterId == null && authReq.user?.role !== 'ADMIN') {
      res.status(403).json({ message: 'Tu usuario no tiene un centro educativo asignado' });
      return;
    }

    const newSubject = await prisma.subject.create({
      data: {
        name,
        code,
        description,
        teacherId,
        educationalCenterId
      }
    });

    res.status(201).json(newSubject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creando la materia' });
  }
};