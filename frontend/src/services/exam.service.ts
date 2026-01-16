import api from './api';

export interface ExamSummary {
  id: number;
  title: string;
  isSubmitted: boolean; 
  score: number | null; 
  _count: { questions: number };
}

export const getExamsBySubject = async (subjectId: number): Promise<ExamSummary[]> => {
  const response = await api.get(`/exams/subject/${subjectId}`);
  return response.data;
};

// Tipos para la creación
export interface CreateExamDTO {
  title: string;
  description: string;
  subjectId: number;
  duration: number;
  questions: {
    text: string;
    points: number;
    options: {
      text: string;
      isCorrect: boolean;
    }[];
  }[];
}

export const createExam = async (examData: CreateExamDTO) => {
  const response = await api.post('/exams', examData);
  return response.data;
};

// Tipo para enviar respuestas
export interface SubmitExamDTO {
  examId: number;
  answers: {
    questionId: number;
    selectedOptionId: number;
  }[];
}

// Obtener un examen individual por ID (para que el alumno lo vea)
export const getExamById = async (id: number) => {
  const response = await api.get(`/exams/${id}`);
  return response.data;
};

// Enviar el examen resuelto
export const submitExamResponses = async (data: SubmitExamDTO) => {
  const response = await api.post('/exams/submit', data);
  return response.data; // El backend nos devolverá la nota (score)
};