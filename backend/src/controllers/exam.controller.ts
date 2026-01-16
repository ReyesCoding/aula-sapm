import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { z } from 'zod';

// ------------------------------------------------------------------
// ESQUEMAS ZOD
// ------------------------------------------------------------------

const createExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  subjectId: z.number(),
  duration: z.number().optional(),
  questions: z.array(z.object({
    text: z.string(),
    points: z.number().default(1),
    options: z.array(z.object({
      text: z.string(),
      isCorrect: z.boolean()
    })).min(2, "Mínimo 2 opciones por pregunta")
  })).min(1, "El examen debe tener al menos 1 pregunta")
});

const submitExamSchema = z.object({
  examId: z.number(),
  answers: z.array(z.object({
    questionId: z.number(),
    selectedOptionId: z.number()
  }))
});

// ------------------------------------------------------------------
// CONTROLADORES
// ------------------------------------------------------------------

// 1. CREAR EXAMEN
export const createExam = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const teacherId = req.user.userId; 
    const data = createExamSchema.parse(req.body);

    const newExam = await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description,
        duration: data.duration,
        subjectId: data.subjectId,
        teacherId: teacherId,
        questions: {
          create: data.questions.map(q => ({
            text: q.text,
            points: q.points,
            options: {
              create: q.options
            }
          }))
        }
      },
      include: { questions: { include: { options: true } } }
    });

    res.status(201).json(newExam);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Error creando examen', error });
  }
};

// 2. OBTENER EXÁMENES POR MATERIA
export const getExamsBySubject = async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.params;
    // @ts-ignore
    const userId = req.user.userId;

    const exams = await prisma.exam.findMany({
      where: { subjectId: Number(subjectId) },
      include: {
        _count: { select: { questions: true } },
        // 👇 TypeScript nos dijo que se llama 'submissions', así que usamos ese.
        submissions: {
           where: { studentId: userId },
           select: { id: true, score: true } 
        }
      }
    });

    const examsWithStatus = exams.map(exam => {
        // Accedemos a .submissions porque así se llama en el include de arriba
        // @ts-ignore (Seguridad extra por si TS se queja del tipo)
        const userSubmission = exam.submissions && exam.submissions.length > 0 
            // @ts-ignore
            ? exam.submissions[0] 
            : null;

        return {
            ...exam,
            isSubmitted: !!userSubmission,
            score: userSubmission ? userSubmission.score : null
        };
    });

    res.json(examsWithStatus);
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ message: 'Error fetching exams' });
  }
};

// 3. OBTENER EXAMEN INDIVIDUAL
export const getExamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const userId = req.user.userId;

    // CORRECCIÓN: Usamos examSubmission
    const existingSubmission = await prisma.examSubmission.findFirst({
        where: { examId: Number(id), studentId: userId }
    });

    const exam = await prisma.exam.findUnique({
      where: { id: Number(id) },
      include: { 
        questions: { 
          include: { 
            options: {
              select: { id: true, text: true, isCorrect: !!existingSubmission } 
            } 
          } 
        } 
      }
    });

    if (!exam) {
       res.status(404).json({ message: 'Examen no encontrado' });
       return;
    }
    
    const responseData = {
        ...exam,
        isSubmitted: !!existingSubmission,
        score: existingSubmission?.score || null
    };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: 'Error cargando examen' });
  }
};

// 4. RESPONDER EXAMEN (Renombrado a submitExam para coincidir con tus rutas)
export const submitExam = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const studentId = req.user.userId;
    const { examId, answers } = submitExamSchema.parse(req.body);

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { 
        questions: { 
            include: { options: true } 
        } 
      }
    });

    if (!exam) { res.status(404).json({ message: "Examen no encontrado" }); return; }

    // CORRECCIÓN: Usamos examSubmission
    const existing = await prisma.examSubmission.findFirst({
        where: { examId, studentId }
    });
    
    if (existing) {
        res.status(400).json({ message: "Ya has realizado este examen." });
        return;
    }

    let earnedPoints = 0;
    let totalPossiblePoints = 0;

    // Algoritmo de Calificación
    exam.questions.forEach(question => {
      const qPoints = question.points || 1;
      totalPossiblePoints += qPoints;

      const studentAnswer = answers.find(a => a.questionId === question.id);

      if (studentAnswer) {
        const selectedOption = question.options.find(o => o.id === studentAnswer.selectedOptionId);
        if (selectedOption && selectedOption.isCorrect) {
          earnedPoints += qPoints;
        }
      }
    });

    let finalScore = 0;
    if (totalPossiblePoints > 0) {
      finalScore = (earnedPoints / totalPossiblePoints) * 100;
    }

    // CORRECCIÓN: Usamos examSubmission
    const submission = await prisma.examSubmission.create({
      data: {
        studentId,
        examId,
        score: finalScore,
        // Si tu modelo requiere guardar 'answers', descomenta la siguiente línea adaptándola a tu esquema:
        // answers: { create: answers.map(...) } 
      }
    });

    res.json(submission);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error procesando examen' });
  }
};