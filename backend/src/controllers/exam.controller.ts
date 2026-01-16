import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { z } from 'zod';

// Esquema de Validación para CREAR examen
const createExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  subjectId: z.number(),
  duration: z.number().optional(), // Minutos
  questions: z.array(z.object({
    text: z.string(),
    points: z.number().default(1),
    options: z.array(z.object({
      text: z.string(),
      isCorrect: z.boolean()
    })).min(2, "Mínimo 2 opciones por pregunta")
  })).min(1, "El examen debe tener al menos 1 pregunta")
});

// Esquema para RESPONDER examen
const submitExamSchema = z.object({
  examId: z.number(),
  answers: z.array(z.object({
    questionId: z.number(),
    selectedOptionId: z.number()
  }))
});

export const createExam = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore (Asumimos que el middleware de auth inyectó el usuario)
    const teacherId = req.user.userId; 
    const data = createExamSchema.parse(req.body);

    // Prisma Magic: Crea Examen, Preguntas y Opciones de un solo golpe 🪄
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

export const getExamsBySubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subjectId } = req.params;
    const exams = await prisma.exam.findMany({
      where: { subjectId: Number(subjectId) },
      include: { _count: { select: { questions: true } } }
    });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo exámenes' });
  }
};

export const getExamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Buscamos el examen. OJO: Si quien pide es ALUMNO, no deberíamos enviar 'isCorrect'.
    // Por simplicidad en v1.0, enviaremos todo, pero el Frontend debe ocultar las respuestas.
    const exam = await prisma.exam.findUnique({
      where: { id: Number(id) },
      include: { 
        questions: { 
          include: { 
            options: {
              select: { id: true, text: true } // 🔒 NO enviamos isCorrect al frontend
            } 
          } 
        } 
      }
    });

    if (!exam) {
       res.status(404).json({ message: 'Examen no encontrado' });
       return;
    }
    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: 'Error cargando examen' });
  }
};

// 🧠 AUTO-CALIFICADOR
export const submitExam = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const studentId = req.user.userId;
    const { examId, answers } = submitExamSchema.parse(req.body);

    // 1. Obtener la "Hoja de Respuestas Correctas" de la BD
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { include: { options: true } } }
    });

    if (!exam) { res.status(404).json({ message: "Examen no existe" }); return; }

    let totalScore = 0;
    let maxScore = 0;

    // 2. Algoritmo de Calificación
    exam.questions.forEach(question => {
      maxScore += question.points;
      
      const studentAnswer = answers.find(a => a.questionId === question.id);
      if (studentAnswer) {
        // Buscar si la opción elegida es la correcta
        const selectedOption = question.options.find(o => o.id === studentAnswer.selectedOptionId);
        if (selectedOption && selectedOption.isCorrect) {
          totalScore += question.points;
        }
      }
    });

    // 3. Calcular nota final (Escala 0-100)
    const finalGrade = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // 4. Guardar Intento
    const submission = await prisma.examSubmission.create({
      data: {
        studentId,
        examId,
        score: finalGrade,
        answers: {
          create: answers.map(a => ({
            questionId: a.questionId,
            selectedOptionId: a.selectedOptionId
          }))
        }
      }
    });

    res.json({ message: "Examen enviado", score: finalGrade, submissionId: submission.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error procesando examen' });
  }
};