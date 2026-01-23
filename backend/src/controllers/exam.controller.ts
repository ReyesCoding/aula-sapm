import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { z } from 'zod';
import { RoleName } from '@prisma/client'; // Asegúrate de importar esto

// ------------------------------------------------------------------
// ESQUEMAS ZOD
// ------------------------------------------------------------------

const createExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  subjectId: z.number(),
  duration: z.number().optional(),
  // 👇 NUEVO: Opción para permitir revisión
  showResults: z.boolean().default(false),
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
        showResults: data.showResults, // 👈 Guardamos la preferencia
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
        // 👇 Usamos la relación definida en el schema (generalmente 'submissions')
        submissions: {
           where: { studentId: userId },
           select: { id: true, score: true } 
        }
      }
    });

    const examsWithStatus = exams.map(exam => {
        // @ts-ignore
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

// 3. OBTENER EXAMEN INDIVIDUAL (Con Lógica de Revisión Segura)
export const getExamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const userId = req.user.userId;
    // @ts-ignore
    const role = req.user.role as RoleName;

    // Buscamos si ya entregó
    const existingSubmission = await prisma.examSubmission.findFirst({
        where: { examId: Number(id), studentId: userId }
    });

    // Traemos el examen completo (incluyendo respuestas correctas por ahora)
    const exam = await prisma.exam.findUnique({
      where: { id: Number(id) },
      include: { 
        questions: { 
          include: { 
            options: true // Traemos todo, filtraremos abajo 👇
          } 
        } 
      }
    });

    if (!exam) {
       res.status(404).json({ message: 'Examen no encontrado' });
       return;
    }
    
    // 🧠 LÓGICA DE SEGURIDAD PARA VER RESPUESTAS
    // Puede ver las respuestas correctas SI:
    // 1. Es PROFESOR
    // 2. O (Es ESTUDIANTE Y ya entregó Y el examen permite ver resultados)
    const canSeeAnswers = 
        role === 'TEACHER' || 
        (!!existingSubmission && exam.showResults);

    // Sanitizamos el objeto antes de enviarlo
    const sanitizedQuestions = exam.questions.map(q => ({
        ...q,
        options: q.options.map(o => ({
            id: o.id,
            text: o.text,
            // Solo enviamos isCorrect si tiene permiso, sino undefined/false
            isCorrect: canSeeAnswers ? o.isCorrect : undefined 
        }))
    }));

    const responseData = {
        ...exam,
        questions: sanitizedQuestions,
        isSubmitted: !!existingSubmission,
        score: existingSubmission?.score || null
    };

    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error cargando examen' });
  }
};

// 4. RESPONDER EXAMEN (Lógica: Suma de Puntos)
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

    const existing = await prisma.examSubmission.findFirst({
        where: { examId, studentId }
    });
    
    if (existing) {
        res.status(400).json({ message: "Ya has realizado este examen." });
        return;
    }

    let earnedPoints = 0;
    
    // Algoritmo de Calificación: Suma directa
    exam.questions.forEach(question => {
      const qPoints = question.points || 1; // Valor de la pregunta
      
      const studentAnswer = answers.find(a => a.questionId === question.id);

      if (studentAnswer) {
        const selectedOption = question.options.find(o => o.id === studentAnswer.selectedOptionId);
        if (selectedOption && selectedOption.isCorrect) {
          earnedPoints += qPoints; // Sumamos los puntos tal cual
        }
      }
    });

    // Nota final = Suma de puntos obtenidos
    const finalScore = earnedPoints;

    const submission = await prisma.examSubmission.create({
      data: {
        studentId,
        examId,
        score: finalScore,
      }
    });

    res.json(submission);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error procesando examen' });
  }
};

// 5. OBTENER RESULTADOS DE UN EXAMEN (SOLO PROFESOR)
export const getExamSubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // ID del examen
    // @ts-ignore
    const { userId, role } = req.user;

    if (role !== 'TEACHER' && role !== 'ADMIN') {
       res.status(403).json({ message: "No tienes permiso para ver estos resultados" });
       return;
    }

    // Verificar que el examen pertenece al profesor (opcional pero recomendado)
    const exam = await prisma.exam.findUnique({ where: { id: Number(id) } });
    if (exam && exam.teacherId !== userId && role !== 'ADMIN') {
       res.status(403).json({ message: "Este examen no te pertenece" });
       return;
    }

    // Obtener las entregas con datos del estudiante
    const submissions = await prisma.examSubmission.findMany({
      where: { examId: Number(id) },
      include: {
        student: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { score: 'desc' } // Ordenar por mejor nota
    });

    res.json(submissions);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error cargando resultados" });
  }
};