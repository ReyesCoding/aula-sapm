import { Request, Response } from 'express';
import prisma from '../prisma/client';

export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { assignments: true, exams: true }
        }
      }
    });
    res.json(subjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error obteniendo materias' });
  }
};
