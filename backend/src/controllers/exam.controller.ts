import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { z } from 'zod';
import { RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { assertSameCenter, HttpError } from '../utils/tenant';

// ------------------------------------------------------------------
// ESQUEMAS ZOD
// ------------------------------------------------------------------

const createExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  subjectId: z.number(),
  duration: z.number().optional(),
  dueDate: z.string().optional(),
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
    const authReq = req as AuthRequest;
    // @ts-ignore
    const teacherId = req.user.userId; 
    const data = createExamSchema.parse(req.body);

    // v2.0: el examen debe pertenecer a una materia del propio profesor y de su centro
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject) {
      res.status(404).json({ message: 'Materia no encontrada' });
      return;
    }
    if (authReq.user?.role === RoleName.TEACHER && subject.teacherId !== teacherId) {
      res.status(403).json({ message: 'No eres el profesor de esta materia' });
      return;
    }
    assertSameCenter(authReq, subject.educationalCenterId);

    const newExam = await prisma.exam.create({
      data: {
        title: data.title,
        description: data.description,
        duration: data.duration,
        subjectId: data.subjectId,
        teacherId: teacherId,
        showResults: data.showResults, 
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
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
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(400).json({ message: 'Error creando examen', error });
  }
};

// 2. OBTENER EXÁMENES POR MATERIA (Con Seguridad de Inscripción)
export const getExamsBySubject = async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.params;
    // @ts-ignore
    const userId = req.user.userId;
    // @ts-ignore
    const role = req.user.role;

    // v2.0: nadie puede consultar exámenes de una materia de otro centro
    const subjectForExamsList = await prisma.subject.findUnique({ where: { id: Number(subjectId) } });
    if (!subjectForExamsList) {
      return res.status(404).json({ message: 'Materia no encontrada' });
    }
    assertSameCenter(req as AuthRequest, subjectForExamsList.educationalCenterId);

    // 🔒 SEGURIDAD: Si es estudiante, verificar inscripción
    if (role === RoleName.STUDENT) {
        const enrollment = await prisma.enrollment.findUnique({
            where: {
                // Prisma genera este nombre para claves compuestas @@unique([studentId, subjectId])
                studentId_subjectId: {
                    studentId: userId,
                    subjectId: Number(subjectId)
                }
            }
        });

        if (!enrollment) {
            return res.status(403).json({ message: 'No tienes acceso a esta materia' });
        }
    }

    const exams = await prisma.exam.findMany({
      where: { subjectId: Number(subjectId) },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
          subject: { select: { name: true } },
        submissions: {
           where: { studentId: userId },
           select: { id: true, score: true } 
        }
      }
    });

    const examsWithStatus = exams.map(exam => {
        const userSubmission = exam.submissions && exam.submissions.length > 0 
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
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
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

    // Traemos el examen completo
    const exam = await prisma.exam.findUnique({
      where: { id: Number(id) },
      include: { 
        questions: { 
          include: { 
            options: true 
          } 
        },
        subject: { select: { educationalCenterId: true } }
      }
    });

    if (!exam) {
       res.status(404).json({ message: 'Examen no encontrado' });
       return;
    }

    // v2.0: no se puede ver un examen de otro centro
    assertSameCenter(req as AuthRequest, exam.subject.educationalCenterId);

    // 🧠 LÓGICA DE SEGURIDAD PARA VER RESPUESTAS CORRECTAS
    const canSeeAnswers = 
        role === 'TEACHER' || 
        (!!existingSubmission && exam.showResults);

    // Sanitizamos el objeto (Ocultamos isCorrect si no tiene permiso)
    const sanitizedQuestions = exam.questions.map(q => ({
        ...q,
        options: q.options.map(o => ({
            id: o.id,
            text: o.text,
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
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error cargando examen' });
  }
};

// 4. RESPONDER EXAMEN (Guarda Respuestas + Calcula Nota)
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
        },
        subject: { select: { educationalCenterId: true } }
      }
    });

    if (!exam) { res.status(404).json({ message: "Examen no encontrado" }); return; }

    // v2.0: no se puede responder un examen de otro centro
    assertSameCenter(req as AuthRequest, exam.subject.educationalCenterId);

    const existing = await prisma.examSubmission.findFirst({
        where: { examId, studentId }
    });
    
    if (existing) {
        res.status(400).json({ message: "Ya has realizado este examen." });
        return;
    }

    let earnedPoints = 0;
    
    // Algoritmo de Calificación
    exam.questions.forEach(question => {
      const qPoints = question.points || 1; 
      const studentAnswer = answers.find(a => a.questionId === question.id);

      if (studentAnswer) {
        const selectedOption = question.options.find(o => o.id === studentAnswer.selectedOptionId);
        if (selectedOption && selectedOption.isCorrect) {
          earnedPoints += qPoints; 
        }
      }
    });

    // ⚠️ CAMBIO CRÍTICO: Guardamos la Submission Y las Respuestas (Answers)
    const submission = await prisma.examSubmission.create({
      data: {
        studentId,
        examId,
        score: earnedPoints,
        // 👇 ESTO ES LO QUE FALTABA: Guardar las respuestas en BD
        answers: {
            create: answers.map(a => ({
                questionId: a.questionId,
                selectedOptionId: a.selectedOptionId
            }))
        }
      }
    });

    res.json(submission);

  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error procesando examen' });
  }
};

// 5. OBTENER RESULTADOS (Profesor)
export const getExamResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; 
    // @ts-ignore
    const { userId, role } = req.user;

    if (role !== 'TEACHER' && role !== 'ADMIN') {
       res.status(403).json({ message: "No tienes permiso" });
       return;
    }

    // v2.0: el profesor solo puede ver resultados de SUS propios exámenes, y de su centro
    const examForResults = await prisma.exam.findUnique({
      where: { id: Number(id) },
      include: { subject: { select: { educationalCenterId: true } } }
    });
    if (!examForResults) {
      res.status(404).json({ message: 'Examen no encontrado' });
      return;
    }
    if (role === 'TEACHER' && examForResults.teacherId !== userId) {
      res.status(403).json({ message: 'No eres el profesor de este examen' });
      return;
    }
    assertSameCenter(req as AuthRequest, examForResults.subject.educationalCenterId);

    const submissions = await prisma.examSubmission.findMany({
      where: { examId: Number(id) },
      include: {
        student: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { score: 'desc' } 
    });

    res.json(submissions);

  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error cargando resultados" });
  }
};

// 6. TOGGLE VISIBILIDAD (Switch del Profesor)
export const toggleExamResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // @ts-ignore
    const { userId, role } = req.user;

    if (role !== 'TEACHER' && role !== 'ADMIN') {
        res.status(403).json({ message: "No autorizado" });
        return;
    }

    const exam = await prisma.exam.findUnique({
      where: { id: Number(id) },
      include: { subject: { select: { educationalCenterId: true } } }
    });
    if (!exam) { res.status(404).json({ message: "Examen no encontrado" }); return; }

    // v2.0: el profesor solo puede modificar SUS propios exámenes, y de su centro
    if (role === 'TEACHER' && exam.teacherId !== userId) {
      res.status(403).json({ message: 'No eres el profesor de este examen' });
      return;
    }
    assertSameCenter(req as AuthRequest, exam.subject.educationalCenterId);

    const updated = await prisma.exam.update({
        where: { id: Number(id) },
        data: { showResults: !exam.showResults } 
    });

    res.json({ showResults: updated.showResults });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Error actualizando estado" });
  }
};